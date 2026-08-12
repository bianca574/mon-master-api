const request = require('supertest');
require('dotenv').config({ path: '.env.test' });
const app = require('../app');
const pool = require('../db');

beforeEach(async () => {
    await pool.query('TRUNCATE programs, documents RESTART IDENTITY CASCADE');
});

afterAll(async () => {
    await pool.end();
});

describe('POST /programs', () => {
    it('creates a program with defaults', async () => {
        const res = await request(app)
            .post('/programs')
            .send({ university: 'Sorbonne', programName: 'STL' });

        expect(res.status).toBe(201);
        expect(res.body.university).toBe('Sorbonne');
        expect(res.body.status).toBe('not_started');
        expect(res.body.documents).toEqual([]);
    });
});

describe('GET /programs', () => {
    it('returns created programs', async () => {
        await request(app).post('/programs').send({ university: 'Saclay', programName: 'IRS' });
        const res = await request(app).get('/programs');

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].university).toBe('Saclay');
    });
});

describe('DELETE /programs/:id', () => {
    it('removes a program', async () => {
        const created = await request(app).post('/programs').send({ university: 'Test U', programName: 'Test' });
        const res = await request(app).delete(`/programs/${created.body.id}`);
        expect(res.status).toBe(204);

        const list = await request(app).get('/programs');
        expect(list.body).toHaveLength(0);
    });
});

describe('POST /programs/:id/documents', () => {
    it('adds and toggles a document', async () => {
        const program = await request(app).post('/programs').send({ university: 'Doc U', programName: 'Test' });
        const doc = await request(app).post(`/programs/${program.body.id}/documents`).send({ label: 'CV' });
        expect(doc.status).toBe(201);
        expect(doc.body.done).toBe(false);

        const toggled = await request(app).patch(`/programs/${program.body.id}/documents/${doc.body.id}`);
        expect(toggled.body.done).toBe(true);
    });
});