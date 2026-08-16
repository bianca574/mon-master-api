const express = require('express');
const pool = require('../db');

const router = express.Router();

function mapLetter(row) {
    return {
        id: row.id,
        programId: row.program_id,
        versionNumber: row.version_number,
        content: row.content,
        createdAt: row.created_at,
    };
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.* FROM letters l
            JOIN programs p ON l.program_id = p.id
            WHERE p.user_id = $1
            ORDER BY l.version_number DESC`,
            [req.userId]
        );
        res.json(result.rows.map(mapLetter));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { programId, content } = req.body;

        const ownerCheck = await pool.query(
            'SELECT id FROM programs WHERE id = $1 AND user_id = $2',
            [programId, req.userId]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Program not found' });
        }

        const maxResult = await pool.query(
            'SELECT COALESCE(MAX(version_number), 0) AS max_version FROM letters WHERE program_id = $1',
            [programId]
        );
        const nextVersion = maxResult.rows[0].max_version + 1;

        const result = await pool.query(
            'INSERT INTO letters (program_id, version_number, content) VALUES ($1, $2, $3) RETURNING *',
            [programId, nextVersion, content]
        );
        res.status(201).json(mapLetter(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM letters WHERE id = $1 
            AND program_id IN (SELECT id FROM programs WHERE user_id = $2)
            RETURNING id`,
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Letter not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;