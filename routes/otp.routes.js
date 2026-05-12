const router = require('express').Router();
const { sendOTP, verifyOTP, getStatus } = require('../controllers/otp.controller');
const { otpSendRateLimiter } = require('../middleware/ratelimiter');
const {
  phoneNumberValidator,
  otpCodeValidator,
  phoneNumberQueryValidator,
} = require('../utils/validators');

/**
 * @route  POST /api/v1/otp/send
 * @desc   Send OTP to phone number
 * @access Public
 */
router.post(
  '/send',
  otpSendRateLimiter,
  [phoneNumberValidator],
  sendOTP
);

/**
 * @route  POST /api/v1/otp/verify
 * @desc   Verify OTP code and receive JWT
 * @access Public
 */
router.post(
  '/verify',
  [phoneNumberValidator, otpCodeValidator],
  verifyOTP
);

/**
 * @route  GET /api/v1/otp/status
 * @desc   Check if phone can request a new OTP (cooldown status)
 * @access Public
 */
router.get(
  '/status',
  [phoneNumberQueryValidator],
  getStatus
);

module.exports = router;
