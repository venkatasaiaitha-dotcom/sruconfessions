const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { confessionLimiter } = require('../middleware/rateLimiter');

// Helper to hash IP for privacy while tracking abuse
function hashIp(ip) {
    if (!ip) return null;
    const salt = process.env.IP_SALT || 'sru_anon_salt_2026';
    return crypto.createHmac('sha256', salt).update(ip).digest('hex').substring(0, 16);
}

// POST /api/confessions - Submit a new confession (Anonymous)
router.post('/', confessionLimiter, async (req, res) => {
    try {
        let { confession } = req.body;

        if (!confession || typeof confession !== 'string') {
            return res.status(400).json({ error: 'Confession text is required.' });
        }

        confession = confession.trim();

        if (confession.length < 3) {
            return res.status(400).json({ error: 'Confession must be at least 3 characters long.' });
        }

        if (confession.length > 3000) {
            return res.status(400).json({ error: 'Confession cannot exceed 3,000 characters.' });
        }

        // Get client IP for rate limiting / anonymized hash
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const ipHash = hashIp(clientIp);

        const created = await db.createConfession(confession, ipHash);

        res.status(201).json({
            success: true,
            message: 'Confession submitted successfully!',
            confession: {
                id: created.id,
                created_at: created.created_at
            }
        });
    } catch (err) {
        console.error('Error submitting confession:', err);
        res.status(500).json({ error: 'An error occurred while submitting your confession.' });
    }
});

module.exports = router;
