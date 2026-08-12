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
        const result = await pool.query('SELECT * FROM letters ORDER BY version_number DESC');
        res.json(result.rows.map(mapLetter));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { programId, content } = req.body;
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
        const result = await pool.query('DELETE FROM letters WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Letter not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;