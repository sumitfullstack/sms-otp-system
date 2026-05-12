const router = require('express').Router();
const { requireAuth } = require('../middleware/auth.middleware');
const jwtService = require('../services/jwt.services');
const User = require('../models/user.model');

/**
 * @route  GET /api/v1/auth/me
 * @desc   Verify token and return decoded payload
 * @access Private (JWT required)
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub).select('-__v');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({ success: true, user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

/**
 * @route  POST /api/v1/auth/refresh
 * @desc   Issue a new token (simple implementation — no refresh token rotation)
 * @access Private (valid JWT required)
 */
router.post('/refresh', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User not found or inactive.' });
    }

    const token = jwtService.generateToken(user);
    return res.status(200).json({
      success: true,
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
