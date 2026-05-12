const jwt = require('jsonwebtoken');
const logger = require('../config/logger');

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    if (!this.secret || this.secret.length < 32) {
      logger.warn('⚠️  JWT_SECRET is missing or too short. Use at least 32 characters in production.');
    }
  }

  /**
   * Generates a signed JWT access token for a user.
   * @param {Object} user - Mongoose User document
   * @returns {string} Signed JWT token
   */
  generateToken(user) {
    const payload = {
      sub: user._id.toString(),  // Subject: user ID
      phone: user.phoneNumber,
      verified: user.isPhoneVerified,
      iat: Math.floor(Date.now() / 1000), // Issued at
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
      issuer: process.env.APP_NAME || 'sms-otp-service',
    });
  }

  /**
   * Verifies and decodes a JWT token.
   * @param {string} token - JWT string to verify
   * @returns {{ valid: boolean, payload?: Object, error?: string }}
   */
  verifyToken(token) {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: process.env.APP_NAME || 'sms-otp-service',
      });
      return { valid: true, payload };
    } catch (error) {
      const errorMap = {
        TokenExpiredError: 'Token has expired',
        JsonWebTokenError: 'Invalid token',
        NotBeforeError: 'Token not yet active',
      };

      return {
        valid: false,
        error: errorMap[error.name] || 'Token verification failed',
      };
    }
  }

  /**
   * Extracts token from Authorization header.
   * Supports "Bearer <token>" format.
   * @param {string} authHeader - Value of the Authorization header
   * @returns {string|null}
   */
  extractFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7).trim() || null;
  }
}

module.exports = new JWTService();
