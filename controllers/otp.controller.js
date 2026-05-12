const { validationResult } = require('express-validator');
const otpService = require('../services/otp.service');
const jwtService = require('../services/jwt.services');
const logger = require('../config/logger');

/**
 * POST /api/v1/otp/send
 * Sends an OTP to the provided phone number.
 */
const sendOTP = async (req, res, next) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { phoneNumber } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress;

    // Check resend cooldown
    const cooldown = await otpService.checkResendCooldown(phoneNumber);
    if (!cooldown.canResend) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${cooldown.secondsRemaining} seconds before requesting another code.`,
        retryAfterSeconds: cooldown.secondsRemaining,
      });
    }

    // Send OTP
    const result = await otpService.sendOTP(phoneNumber, ipAddress);

    const response = {
      success: true,
      message: 'Verification code sent successfully.',
      expiresAt: result.expiresAt,
      expiresInSeconds: Math.floor((result.expiresAt - Date.now()) / 1000),
    };

    // Include mock flag only in non-production (for testing/demo purposes)
    if (result.mock && process.env.NODE_ENV !== 'production') {
      response.mock = true;
      response.devNote = 'SMS not sent — running in mock mode. Check server logs for the OTP code.';
    }

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/otp/verify
 * Verifies an OTP and returns a JWT on success.
 */
const verifyOTP = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { phoneNumber, code } = req.body;

    // Verify OTP and get user
    const { user } = await otpService.verifyOTP(phoneNumber, code.toString().trim());

    // Generate JWT
    const token = jwtService.generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Phone number verified successfully.',
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      user: user.toPublicJSON(),
    });
  } catch (error) {
    // Handle known OTP errors gracefully
    if (error.name === 'OTPError') {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        ...error.meta,
      });
    }
    next(error);
  }
};

/**
 * GET /api/v1/otp/status
 * Returns verification status for a phone number (no auth required).
 */
const getStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { phoneNumber } = req.query;
    const cooldown = await otpService.checkResendCooldown(phoneNumber);

    return res.status(200).json({
      success: true,
      canRequestOTP: cooldown.canResend,
      ...(cooldown.secondsRemaining && { retryAfterSeconds: cooldown.secondsRemaining }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { sendOTP, verifyOTP, getStatus };
