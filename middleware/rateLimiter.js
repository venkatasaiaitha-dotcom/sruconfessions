const rateLimit = require('express-rate-limit');

// Rate limiter for submitting confessions: max 10 submissions per 10 minutes per IP
const confessionLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many confessions submitted from this IP. Please wait a few minutes before submitting again.'
    }
});

// Rate limiter for admin login: max 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: 'Too many login attempts. Please try again after 15 minutes.'
    }
});

module.exports = {
    confessionLimiter,
    loginLimiter
};
