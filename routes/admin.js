const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateAdmin } = require('../middleware/auth');

// All routes in this router require admin authentication
router.use(authenticateAdmin);

// GET /api/admin/confessions - Get all confessions with optional search and pagination
router.get('/confessions', async (req, res) => {
    try {
        const search = req.query.search ? String(req.query.search).trim() : '';
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const offset = (page - 1) * limit;

        const confessions = await db.getConfessions({ limit, offset, search });
        const total = await db.countConfessions(search);
        const stats = await db.getStats();

        // Format timestamps to user friendly format if desired
        const formattedConfessions = confessions.map(item => {
            const rawDate = item.created_at;
            let formattedTime = rawDate;
            try {
                formattedTime = new Date(rawDate).toLocaleString();
            } catch {
                formattedTime = rawDate;
            }

            return {
                id: item.id,
                confession: item.confession,
                status: item.status,
                created_at: item.created_at,
                timestamp: formattedTime
            };
        });

        res.json({
            success: true,
            confessions: formattedConfessions,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            },
            stats
        });
    } catch (err) {
        console.error('Error fetching confessions for admin:', err);
        res.status(500).json({ error: err.message || 'Failed to retrieve confessions.' });
    }
});

// GET /api/admin/stats - Get overview stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await db.getStats();
        res.json({ success: true, stats });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ error: err.message || 'Failed to retrieve stats.' });
    }
});

// DELETE /api/admin/confessions/:id - Delete a confession
router.delete('/confessions/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid confession ID.' });
        }

        const existing = await db.getConfessionById(id);
        if (!existing) {
            return res.status(404).json({ error: 'Confession not found.' });
        }

        const deleted = await db.deleteConfession(id);
        if (!deleted) {
            return res.status(500).json({ error: 'Could not delete confession.' });
        }

        res.json({
            success: true,
            message: `Confession #${id} deleted successfully.`
        });
    } catch (err) {
        console.error('Error deleting confession:', err);
        res.status(500).json({ error: err.message || 'Failed to delete confession.' });
    }
});

module.exports = router;
