const { body, query } = require('express-validator');

/**
 * Validates E.164 formatted phone number.
 * Format: +[country code][number], e.g. +14155552671
 */
const phoneNumberValidator = body('phoneNumber')
  .trim()
  .notEmpty().withMessage('Phone number is required.')
  .matches(/^\+[1-9]\d{7,14}$/)
  .withMessage('Phone number must be in E.164 format (e.g. +14155552671).');

/**
 * Validates OTP code (numeric string).
 */
const otpCodeValidator = body('code')
  .trim()
  .notEmpty().withMessage('Verification code is required.')
  .isNumeric().withMessage('Verification code must contain only numbers.')
  .isLength({ min: 4, max: 8 }).withMessage('Verification code must be 4-8 digits.');

/**
 * Validates phone number in query string (for GET requests).
 */
const phoneNumberQueryValidator = query('phoneNumber')
  .trim()
  .notEmpty().withMessage('Phone number is required.')
  .matches(/^\+[1-9]\d{7,14}$/)
  .withMessage('Phone number must be in E.164 format.');

/**
 * Validates user name for profile update.
 */
const nameValidator = body('name')
  .optional()
  .trim()
  .isLength({ min: 1, max: 100 }).withMessage('Name must be between 1 and 100 characters.')
  .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name contains invalid characters.');

module.exports = {
  phoneNumberValidator,
  otpCodeValidator,
  phoneNumberQueryValidator,
  nameValidator,
};
