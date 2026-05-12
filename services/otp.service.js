const OTP = require('../models/otp.model');
const User = require('../models/user.model');
const smsService = require('../services/sms.service');
const logger = require('../config/logger');

class OTPService {
  /**
   * Sends a new OTP to the given phone number.
   * Invalidates any existing pending OTPs for the same number.
   *
   * @param {string} phoneNumber - E.164 formatted phone number
   * @param {string} [ipAddress] - Request IP for audit logging
   * @returns {Promise<{ success: boolean, expiresAt: Date, mock?: boolean }>}
   */
  async sendOTP(phoneNumber, ipAddress = null) {
    // Invalidate all previous pending OTPs for this number
    await OTP.updateMany(
      { phoneNumber, status: OTP.STATUS.PENDING },
      { $set: { status: OTP.STATUS.EXPIRED } }
    );

    // Generate a new OTP
    const otpLength = parseInt(process.env.OTP_LENGTH) || 6;
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 2;
    const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 3;

    const plainCode = OTP.generateCode(otpLength);
    const codeHash = OTP.hashCode(plainCode);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Save OTP record (hashed)
    const otpRecord = await OTP.create({
      phoneNumber,
      codeHash,
      expiresAt,
      maxAttempts,
      ipAddress,
    });

    logger.debug(`OTP created for ${this._maskPhone(phoneNumber)}, expires at ${expiresAt}`);

    // Send via SMS
    const smsResult = await smsService.sendOTP(phoneNumber, plainCode);

    return {
      success: true,
      expiresAt,
      otpId: otpRecord._id,
      ...(smsResult.mock && { mock: true }), // Only include in non-production
    };
  }

  /**
   * Verifies an OTP code submitted by the user.
   * Updates user verification status on success.
   *
   * @param {string} phoneNumber - E.164 formatted phone number
   * @param {string} code - OTP code entered by user
   * @returns {Promise<{ success: boolean, user: Object, token: string }>}
   * @throws {OTPError} On invalid, expired, or exhausted OTP
   */
  async verifyOTP(phoneNumber, code) {
    // Find the most recent pending OTP for this number
    const otpRecord = await OTP.findOne({
      phoneNumber,
      status: OTP.STATUS.PENDING,
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      throw new OTPError('No active verification code found. Please request a new one.', 'OTP_NOT_FOUND', 404);
    }

    // Check expiration
    if (otpRecord.isExpired()) {
      await OTP.findByIdAndUpdate(otpRecord._id, { status: OTP.STATUS.EXPIRED });
      throw new OTPError(
        'Verification code has expired. Please request a new one.',
        'OTP_EXPIRED',
        410
      );
    }

    // Check attempt count
    if (otpRecord.isExhausted()) {
      await OTP.findByIdAndUpdate(otpRecord._id, { status: OTP.STATUS.EXHAUSTED });
      throw new OTPError(
        'Too many failed attempts. Please request a new code.',
        'OTP_EXHAUSTED',
        429
      );
    }

    // Verify code (timing-safe comparison)
    const isValid = otpRecord.verifyCode(code);

    if (!isValid) {
      // Increment attempt counter
      const updated = await OTP.findByIdAndUpdate(
        otpRecord._id,
        { $inc: { attempts: 1 } },
        { new: true }
      );

      const remainingAttempts = updated.maxAttempts - updated.attempts;

      if (remainingAttempts <= 0) {
        await OTP.findByIdAndUpdate(otpRecord._id, { status: OTP.STATUS.EXHAUSTED });
        throw new OTPError(
          'Too many failed attempts. Please request a new code.',
          'OTP_EXHAUSTED',
          429
        );
      }

      throw new OTPError(
        `Invalid code. ${remainingAttempts} attempt(s) remaining.`,
        'OTP_INVALID',
        400,
        { remainingAttempts }
      );
    }

    // ✅ OTP is valid — mark as verified
    await OTP.findByIdAndUpdate(otpRecord._id, {
      status: OTP.STATUS.VERIFIED,
      verifiedAt: new Date(),
    });

    // Upsert user and mark phone as verified
    const user = await User.findOneAndUpdate(
      { phoneNumber },
      {
        $set: {
          isPhoneVerified: true,
          phoneVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        },
        $setOnInsert: { phoneNumber },
      },
      { upsert: true, new: true }
    );

    logger.info(`✅ Phone verified: ${this._maskPhone(phoneNumber)} | User: ${user._id}`);

    return { success: true, user };
  }

  /**
   * Checks cooldown period before allowing OTP resend.
   * @param {string} phoneNumber
   * @returns {Promise<{ canResend: boolean, secondsRemaining?: number }>}
   */
  async checkResendCooldown(phoneNumber) {
    const cooldownSeconds = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 30;
    const cooldownMs = cooldownSeconds * 1000;

    const recentOTP = await OTP.findOne({ phoneNumber })
      .sort({ createdAt: -1 })
      .select('createdAt');

    if (!recentOTP) return { canResend: true };

    const elapsed = Date.now() - recentOTP.createdAt.getTime();

    if (elapsed < cooldownMs) {
      const secondsRemaining = Math.ceil((cooldownMs - elapsed) / 1000);
      return { canResend: false, secondsRemaining };
    }

    return { canResend: true };
  }

  _maskPhone(phone) {
    if (!phone || phone.length < 7) return '***';
    return phone.slice(0, 5) + '***' + phone.slice(-3);
  }
}

/**
 * Custom error class for OTP validation failures.
 */
class OTPError extends Error {
  constructor(message, code, statusCode = 400, meta = {}) {
    super(message);
    this.name = 'OTPError';
    this.code = code;
    this.statusCode = statusCode;
    this.meta = meta;
  }
}

module.exports = new OTPService();
module.exports.OTPError = OTPError;
