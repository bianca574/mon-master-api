const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const requireAuth = require('../middleware/auth');
const crypto = require('crypto');
const { Resend } = require('resend');

const router = express.Router();

function getResendClient() {
    return new Resend(process.env.RESEND_API_KEY);
}

router.post('/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
            [email, passwordHash, name]
        );
        const user = result.rows[0];

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/me', requireAuth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        const result = await pool.query(
            'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name',
            [name.trim(), req.userId]
        );
        res.json({ user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/request-reset', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            await pool.query(
                'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
                [userId, tokenHash, expiresAt]
            );

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

            const resend = getResendClient();
            await resend.emails.send({
                from: 'MonMaster Companion <onboarding@resend.dev>',
                to: email,
                subject: 'Réinitialisation de votre mot de passe',
                html: `
                <p>Bonjour,</p>
                <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                <p><a href="${resetUrl}">Cliquez ici pour choisir un nouveau mot de passe</a></p>
                <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
              `,
            });
        }

        // Same response whether or not the email exists
        res.json({ message: 'Si un compte existe avec cet email, un lien a été envoyé.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const tokenResult = await pool.query(
            `SELECT * FROM password_reset_tokens
            WHERE token_hash = $1 AND used = false AND expires_at > now()`,
            [tokenHash]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(400).json({ error: 'Lien invalide ou expiré' });
        }

        const resetToken = tokenResult.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetToken.user_id]);
        await pool.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [resetToken.id]);

        res.json({ message: 'Mot de passe mis à jour' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;