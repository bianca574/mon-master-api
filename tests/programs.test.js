const request = require('supertest');
require('dotenv').config({ path: '.env.test' });
const app = require('../app');
const pool = require('../db');

let token;

beforeEach(async () => {
    await pool.query('TRUNCATE users, programs, documents RESTART IDENTITY CASCADE');
    const signup = await request(app)
        .post('/auth/signup')
        .send({ email: 'test@example.com', password: 'testpass123' });
    token = signup.body.token;
});

afterAll(async () => {
    await pool.end();
});

describe('POST /programs', () => {
    it('creates a program with defaults', async () => {
        const res = await request(app)
            .post('/programs')
            .set('Authorization', `Bearer ${token}`)
            .send({ university: 'Sorbonne', programName: 'STL' });

        expect(res.status).toBe(201);
        expect(res.body.university).toBe('Sorbonne');
        expect(res.body.status).toBe('not_started');
        expect(res.body.documents).toEqual([]);
    });

    it('rejects requests without a token', async () => {
        const res = await request(app).post('/programs').send({ university: 'X', programName: 'Y' });
        expect(res.status).toBe(401);
    });
});

describe('GET /programs', () => {
    it('returns only the authenticated user\'s programs', async () => {
        await request(app).post('/programs').set('Authorization', `Bearer ${token}`).send({ university: 'Saclay', programName: 'IRS' });
        const res = await request(app).get('/programs').set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].university).toBe('Saclay');
    });
});

describe('DELETE /programs/:id', () => {
    it('removes a program', async () => {
        const created = await request(app).post('/programs').set('Authorization', `Bearer ${token}`).send({ university: 'Test U', programName: 'Test' });
        const res = await request(app).delete(`/programs/${created.body.id}`).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(204);

        const list = await request(app).get('/programs').set('Authorization', `Bearer ${token}`);
        expect(list.body).toHaveLength(0);
    });
});

describe('POST /programs/:id/documents', () => {
    it('adds and toggles a document', async () => {
        const program = await request(app).post('/programs').set('Authorization', `Bearer ${token}`).send({ university: 'Doc U', programName: 'Test' });
        const doc = await request(app).post(`/programs/${program.body.id}/documents`).set('Authorization', `Bearer ${token}`).send({ label: 'CV' });
        expect(doc.status).toBe(201);
        expect(doc.body.done).toBe(false);

        const toggled = await request(app).patch(`/programs/${program.body.id}/documents/${doc.body.id}`).set('Authorization', `Bearer ${token}`);
        expect(toggled.body.done).toBe(true);
    });
});