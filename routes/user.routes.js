const router = require('express').Router();
const { getProfile, updateProfile } = require('../controllers/user.controller');
const { requireAuth, requireVerified } = require('../middleware/auth.middleware');
const { nameValidator } = require('../utils/validators');

// All user routes require authentication
router.use(requireAuth);

/**
 * @route  GET /api/v1/user/me
 * @desc   Get current user profile
 * @access Private
 */
router.get('/me', requireVerified, getProfile);

/**
 * @route  PUT /api/v1/user/me
 * @desc   Update current user profile
 * @access Private
 */
router.put('/me', requireVerified, [nameValidator], updateProfile);

module.exports = router;
