const express = require('express');
const pool = require('../db');

const router = express.Router();

function mapEntry(row) {
    return {
        id: row.id,
        programId: row.program_id,
        date: row.entry_date,
        text: row.text,
        createdAt: row.created_at,
    };
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM journal_entries ORDER BY entry_date DESC');
        res.json(result.rows.map(mapEntry));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { programId, date, text } = req.body;
        const result = await pool.query(
            'INSERT INTO journal_entries (program_id, entry_date, text) VALUES ($1, $2, $3) RETURNING *',
            [programId || null, date, text]
        );
        res.status(201).json(mapEntry(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM journal_entries WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;