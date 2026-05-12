const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter: Applied to all routes.
 * Protects against general API abuse.
 */
const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,   // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,     // Disable X-RateLimit-* headers
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  skip: (req) => req.path === '/health', // Skip health checks
});

/**
 * OTP send rate limiter: Stricter limit for SMS send endpoint.
 * Prevents SMS cost abuse and SMS bombing attacks.
 */
const otpSendRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10-minute window
  max: parseInt(process.env.OTP_RATE_LIMIT_MAX) || 5,
  keyGenerator: (req) => {
    // Rate limit per phone number, not per IP
    // This prevents bypassing by rotating IPs
    return req.body?.phoneNumber || req.ip;
  },
  message: {
    success: false,
    message: 'Too many OTP requests for this number. Please wait before trying again.',
    code: 'OTP_RATE_LIMIT_EXCEEDED',
  },
});

module.exports = { globalRateLimiter, otpSendRateLimiter };
