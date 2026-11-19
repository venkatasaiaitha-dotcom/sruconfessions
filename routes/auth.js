const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimiter');

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const admin = await db.getAdminByUsername(username.trim());
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials!' });
        }

        const isValid = bcrypt.compareSync(password, admin.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials!' });
        }

        const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_in_prod';
        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: 'admin' },
            secret,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: admin.id,
                username: admin.username
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// GET /api/auth/verify - Check token validity
router.get('/verify', authenticateAdmin, (req, res) => {
    res.json({
        success: true,
        valid: true,
        user: req.user
    });
});

// POST /api/auth/change-password
router.post('/change-password', authenticateAdmin, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required.' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
        }

        const admin = await db.getAdminByUsername(req.user.username);
        if (!admin) {
            return res.status(404).json({ error: 'Admin account not found.' });
        }

        const isValid = bcrypt.compareSync(currentPassword, admin.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect current password.' });
        }

        const newHash = bcrypt.hashSync(newPassword, 10);
        await db.updateAdminPassword(admin.username, newHash);

        res.json({ success: true, message: 'Password updated successfully!' });
    } catch (err) {
        console.error('Password change error:', err);
        res.status(500).json({ error: 'Server error updating password.' });
    }
});

module.exports = router;
