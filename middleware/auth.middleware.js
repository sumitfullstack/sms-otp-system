const jwtService = require('../services/jwt.services');
const User = require('../models/user.model');

/**
 * Middleware: Require valid JWT token.
 * Attaches decoded payload to req.user on success.
 */
const requireAuth = async (req, res, next) => {
  const token = jwtService.extractFromHeader(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      code: 'TOKEN_MISSING',
    });
  }

  const { valid, payload, error } = jwtService.verifyToken(token);

  if (!valid) {
    return res.status(401).json({
      success: false,
      message: error || 'Invalid token.',
      code: 'TOKEN_INVALID',
    });
  }

  req.user = payload; // Attach decoded payload { sub, phone, verified }
  next();
};

/**
 * Middleware: Require phone to be verified.
 * Must be used AFTER requireAuth.
 */
const requireVerified = (req, res, next) => {
  if (!req.user?.verified) {
    return res.status(403).json({
      success: false,
      message: 'Phone verification required to access this resource.',
      code: 'PHONE_NOT_VERIFIED',
    });
  }
  next();
};

module.exports = { requireAuth, requireVerified };
