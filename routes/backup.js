const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.post('/import', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const data = req.body;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Invalid backup file' });
        }

        await client.query('BEGIN');

        // Wipe existing data for this user (documents, letters, and
        // recommendation_programs links cascade automatically via the schema)
        await client.query('DELETE FROM journal_entries WHERE user_id = $1', [req.userId]);
        await client.query('DELETE FROM criteria WHERE user_id = $1', [req.userId]);
        await client.query('DELETE FROM recommendations WHERE user_id = $1', [req.userId]);
        await client.query('DELETE FROM programs WHERE user_id = $1', [req.userId]);

        // Criteria first, so program.scores keys can be remapped
        const criteriaMap = {};
        for (const c of data.criteria || []) {
            const result = await client.query(
                'INSERT INTO criteria (user_id, name, weight) VALUES ($1, $2, $3) RETURNING id',
                [req.userId, c.name, c.weight ?? 10]
            );
            criteriaMap[c.id] = result.rows[0].id;
        }

        // Programs + their nested documents
        const programMap = {};
        for (const p of data.programs || []) {
            const newScores = {};
            for (const [oldCriteriaId, score] of Object.entries(p.scores || {})) {
                if (criteriaMap[oldCriteriaId]) newScores[criteriaMap[oldCriteriaId]] = score;
            }

            const result = await client.query(
                `INSERT INTO programs (user_id, university, program_name, status, deadline, website, notes, tags, scores)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [req.userId, p.university, p.programName, p.status || 'not_started', p.deadline || null, p.website || '', p.notes || '', p.tags || [], JSON.stringify(newScores)]
            );
            const newProgramId = result.rows[0].id;
            programMap[p.id] = newProgramId;

            for (const doc of p.documents || []) {
                await client.query(
                    'INSERT INTO documents (program_id, label, done) VALUES ($1, $2, $3)',
                    [newProgramId, doc.label, doc.done || false]
                );
            }
        }

        // Recommendations + their program links
        for (const r of data.recommendations || []) {
            const result = await client.query(
                `INSERT INTO recommendations (user_id, name, institution, status, asked_date, notes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [req.userId, r.name, r.institution || '', r.status || 'not_asked', r.askedDate || null, r.notes || '']
            );
            const newRecId = result.rows[0].id;

            for (const oldProgramId of r.programIds || []) {
                const newProgramId = programMap[oldProgramId];
                if (newProgramId) {
                    await client.query(
                        'INSERT INTO recommendation_programs (recommendation_id, program_id) VALUES ($1, $2)',
                        [newRecId, newProgramId]
                    );
                }
            }
        }

        // Letters
        for (const l of data.letters || []) {
            const newProgramId = programMap[l.programId];
            if (!newProgramId) continue;
            await client.query(
                'INSERT INTO letters (program_id, version_number, content) VALUES ($1, $2, $3)',
                [newProgramId, l.versionNumber, l.content]
            );
        }

        // Journal entries
        for (const j of data.journal || []) {
            const newProgramId = j.programId ? programMap[j.programId] : null;
            await client.query(
                'INSERT INTO journal_entries (user_id, program_id, entry_date, text) VALUES ($1, $2, $3, $4)',
                [req.userId, newProgramId, j.date, j.text]
            );
        }

        await client.query('COMMIT');
        res.json({ status: 'ok' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;