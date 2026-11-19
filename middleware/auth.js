const jwt = require('jsonwebtoken');

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Access denied. No authorization header provided.' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Malformed authorization header. Expected "Bearer <token>".' });
    }

    const token = parts[1];
    const secret = process.env.JWT_SECRET || 'fallback_secret_key_change_in_prod';

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }
        return res.status(403).json({ error: 'Invalid or revoked token.' });
    }
}

module.exports = {
    authenticateAdmin
};
