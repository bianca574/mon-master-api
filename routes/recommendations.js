const express = require('express');
const pool = require('../db');

const router = express.Router();

function mapRecommendation(row, programIds) {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution,
    status: row.status,
    askedDate: row.asked_date,
    notes: row.notes,
    programIds: programIds || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const recsResult = await pool.query(
      'SELECT * FROM recommendations WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    const linksResult = await pool.query(
      `SELECT rp.* FROM recommendation_programs rp
       JOIN recommendations r ON rp.recommendation_id = r.id
       WHERE r.user_id = $1`,
      [req.userId]
    );

    const recommendations = recsResult.rows.map((row) => {
      const programIds = linksResult.rows
        .filter((l) => l.recommendation_id === row.id)
        .map((l) => l.program_id);
      return mapRecommendation(row, programIds);
    });

    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, institution, status, askedDate, notes, programIds } = req.body;
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO recommendations (user_id, name, institution, status, asked_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, name, institution || '', status || 'not_asked', askedDate || null, notes || '']
    );
    const rec = result.rows[0];

    for (const programId of programIds || []) {
      await client.query(
        'INSERT INTO recommendation_programs (recommendation_id, program_id) VALUES ($1, $2)',
        [rec.id, programId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(mapRecommendation(rec, programIds || []));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, institution, status, askedDate, notes, programIds } = req.body;
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE recommendations
       SET name = $1, institution = $2, status = $3, asked_date = $4, notes = $5, updated_at = now()
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, institution, status, askedDate || null, notes, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    await client.query('DELETE FROM recommendation_programs WHERE recommendation_id = $1', [req.params.id]);
    for (const programId of programIds || []) {
      await client.query(
        'INSERT INTO recommendation_programs (recommendation_id, program_id) VALUES ($1, $2)',
        [req.params.id, programId]
      );
    }

    await client.query('COMMIT');
    res.json(mapRecommendation(result.rows[0], programIds || []));
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM recommendations WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Recommendation not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;