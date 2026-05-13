const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * OTP status states:
 * - 'pending'  : Sent, awaiting verification
 * - 'verified' : Successfully verified
 * - 'expired'  : Timed out before verification
 * - 'exhausted': Too many failed attempts
 */
const OTP_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  EXPIRED: 'expired',
  EXHAUSTED: 'exhausted',
};

const otpSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
    },

    codeHash: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(OTP_STATUS),
      default: OTP_STATUS.PENDING,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    maxAttempts: {
      type: Number,
      default: 3,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });

otpSchema.index({ phoneNumber: 1, status: 1, expiresAt: 1 });


otpSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

/**
 * Checks if max attempts have been reached.
 * @returns {boolean}
 */
otpSchema.methods.isExhausted = function () {
  return this.attempts >= this.maxAttempts;
};


otpSchema.methods.verifyCode = function (plainCode) {
  const hash = crypto
    .createHash('sha256')
    .update(plainCode.toString())
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(this.codeHash)
    );
  } catch {
    return false;
  }
};

// --- Static Methods ---

/**
 * Hashes a plaintext OTP code.
 * @param {string} plainCode
 * @returns {string} SHA-256 hex hash
 */
otpSchema.statics.hashCode = function (plainCode) {
  return crypto
    .createHash('sha256')
    .update(plainCode.toString())
    .digest('hex');
};

/**
 * Generates a random numeric OTP of specified length.
 * @param {number} length - Number of digits (default: 6)
 * @returns {string} Zero-padded numeric OTP
 */
otpSchema.statics.generateCode = function (length = 6) {
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  // Use crypto for cryptographically secure randomness
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0);
  const code = (min + (randomNum % (max - min))).toString();
  return code.padStart(length, '0');
};

const OTP = mongoose.model('OTP', otpSchema);
OTP.STATUS = OTP_STATUS;

module.exports = OTP;
