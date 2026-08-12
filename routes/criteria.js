const express = require('express');
const pool = require('../db');

const router = express.Router();

function mapCriterion(row) {
    return {
        id: row.id,
        name: row.name,
        weight: row.weight
    };
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM criteria ORDER BY name');
        res.json(result.rows.map(mapCriterion));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, weight } = req.body;
        const result = await pool.query(
            'INSERT INTO criteria (name, weight) VALUES ($1, $2) RETURNING *',
            [name, weight ?? 10]
        );
        res.status(201).json(mapCriterion(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { name, weight } = req.body;
        const result = await pool.query(
            'UPDATE criteria SET name = $1, weight = $2 WHERE id = $3 RETURNING *',
            [name, weight, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Criterion not found' });
        res.json(mapCriterion(result.rows[0]));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM criteria WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Criterion not found' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;