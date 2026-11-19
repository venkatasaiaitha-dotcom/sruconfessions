require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const db = require('./db');
const authRoutes = require('./routes/auth');
const confessionRoutes = require('./routes/confessions');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for rate limiting if behind reverse proxy / cloud load balancer
app.set('trust proxy', 1);

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));

// API Routes: mount for localhost, Vercel, and Netlify function paths
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/.netlify/functions/api/auth', authRoutes);

app.use('/api/confessions', confessionRoutes);
app.use('/confessions', confessionRoutes);
app.use('/.netlify/functions/api/confessions', confessionRoutes);

app.use('/api/admin', adminRoutes);
app.use('/admin', adminRoutes);
app.use('/.netlify/functions/api/admin', adminRoutes);

// Health Check
app.get(['/api/health', '/health', '/.netlify/functions/api/health'], (req, res) => {
    res.json({
        status: 'ok',
        database: db.getDriver(),
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Fallback for unmatched API routes
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/.netlify/functions/api/')) {
        return res.status(404).json({ error: 'API route not found' });
    }
    next();
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('[Server Error]:', err.stack || err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

// Initialize DB on boot
db.initDb().catch(err => console.error('DB init error:', err));

// Start listening if not running inside serverless (Netlify / Vercel / AWS Lambda)
const isServerlessEnvironment = Boolean(process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerlessEnvironment) {
    app.listen(PORT, () => {
        console.log('====================================================');
        console.log(`🚀 SRU Confessions Server is running!`);
        console.log(`🌐 Local URL: http://localhost:${PORT}`);
        console.log(`📊 Database Engine: ${db.getDriver() ? db.getDriver().toUpperCase() : 'INITIALIZING'}`);
        console.log('====================================================');
    });
}

module.exports = app;
