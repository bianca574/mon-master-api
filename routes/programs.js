const express = require('express');
const pool = require('../db');

const router = express.Router();

function mapProgram(row) {
  return {
    id: row.id,
    university: row.university,
    programName: row.program_name,
    status: row.status,
    deadline: row.deadline,
    website: row.website,
    notes: row.notes,
    tags: row.tags,
    scores: row.scores,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row) {
  return { id: row.id, label: row.label, done: row.done };
}

// GET /programs — list all, each with its documents attached
router.get('/', async (req, res) => {
  try {
    const programsResult = await pool.query(
      'SELECT * FROM programs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    const documentsResult = await pool.query(
      `SELECT d.* FROM documents d
      JOIN programs p ON d.program_id = p.id
      WHERE p.user_id = $1`,
      [req.userId]
    );
    const programs = programsResult.rows.map((row) => {
      const program = mapProgram(row);
      program.documents = documentsResult.rows
        .filter((d) => d.program_id === row.id)
        .map(mapDocument);
      return program;
    });

    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /programs/:id — one program with its documents
router.get('/:id', async (req, res) => {
  try {
    const programResult = await pool.query(
      'SELECT * FROM programs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (programResult.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    const documentsResult = await pool.query('SELECT * FROM documents WHERE program_id = $1', [req.params.id]);

    const program = mapProgram(programResult.rows[0]);
    program.documents = documentsResult.rows.map(mapDocument);

    res.json(program);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /programs — create
router.post('/', async (req, res) => {
  try {
    const { university, programName, status, deadline, website, notes, tags } = req.body;
    const result = await pool.query(
      `INSERT INTO programs (user_id, university, program_name, status, deadline, website, notes, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, university, programName, status || 'not_started', deadline || null, website || '', notes || '', tags || []]
    );
    res.status(201).json({ ...mapProgram(result.rows[0]), documents: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /programs/:id — update
router.put('/:id', async (req, res) => {
  try {
    const { university, programName, status, deadline, website, notes, tags } = req.body;
    const result = await pool.query(
      `UPDATE programs
      SET university = $1, program_name = $2, status = $3, deadline = $4,
           website = $5, notes = $6, tags = $7, updated_at = now()
      WHERE id = $8 AND user_id = $9
      RETURNING *`,
      [university, programName, status, deadline || null, website, notes, tags || [], req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json(mapProgram(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /programs/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM programs WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Document sub-routes ---

// POST /programs/:id/documents — add a document
router.post('/:id/documents', async (req, res) => {
  try {
    const ownerCheck = await pool.query(
      'SELECT id FROM programs WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    const result = await pool.query(
      'INSERT INTO documents (program_id, label) VALUES ($1, $2) RETURNING *',
      [req.params.id, req.body.label]
    );
    res.status(201).json(mapDocument(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /programs/:id/documents/:docId — toggle done
router.patch('/:id/documents/:docId', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE documents SET done = NOT done
      WHERE id = $1 AND program_id = $2
      AND program_id IN (SELECT id FROM programs WHERE user_id = $3)
      RETURNING *`,
      [req.params.docId, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(mapDocument(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /programs/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM documents WHERE id = $1 AND program_id = $2
      AND program_id IN (SELECT id FROM programs WHERE user_id = $3)
      RETURNING id`,
      [req.params.docId, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/scores', async (req, res) => {
  try {
    const { criteriaId, score } = req.body;
    const result = await pool.query(
      `UPDATE programs
       SET scores = jsonb_set(scores, $1, to_jsonb($2::int)), updated_at = now()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [`{${criteriaId}}`, score, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json(mapProgram(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;