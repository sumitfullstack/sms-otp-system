const twilio = require('twilio');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    this.client = null;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this._initialize();
  }

  /**
   * Initializes the Twilio client.
   * Skips in test/dev if credentials are missing (uses mock mode).
   */
  _initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (accountSid && authToken && accountSid.startsWith('AC')) {
      try {
        this.client = twilio(accountSid, authToken);
        logger.info('✅ Twilio SMS client initialized');
      } catch (error) {
        logger.warn(`⚠️  Twilio initialization failed: ${error.message}`);
      }
    } else {
      logger.warn('⚠️  Twilio credentials not set — running in MOCK SMS mode');
    }
  }

  /**
   * Sends an OTP SMS message to the given phone number.
   * @param {string} to - Destination phone number in E.164 format
   * @param {string} otp - The OTP code to send
   * @returns {Promise<{ success: boolean, messageId?: string, mock?: boolean }>}
   */
  async sendOTP(to, otp) {
    const body = this._formatOTPMessage(otp);

    // Mock mode: log to console instead of sending real SMS
    if (!this.client) {
      logger.info(`📱 [MOCK SMS] To: ${to} | Message: "${body}"`);
      return { success: true, mock: true, messageId: `mock_${Date.now()}` };
    }

    try {
      const message = await this.client.messages.create({
        body,
        from: this.fromNumber,
        to,
      });

      logger.info(`✅ SMS sent to ${this._maskPhone(to)} | SID: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error) {
      logger.error(`❌ SMS send failed to ${this._maskPhone(to)}: ${error.message}`);
      throw new SMSError(error.message, error.code);
    }
  }

  /**
   * Formats the OTP SMS body.
   * @param {string} otp
   * @returns {string}
   */
  _formatOTPMessage(otp) {
    const appName = process.env.APP_NAME || 'Verification Service';
    const expiryMins = process.env.OTP_EXPIRY_MINUTES || 2;
    return `Your ${appName} verification code is: ${otp}. Valid for ${expiryMins} minutes. Do not share this code with anyone.`;
  }

  /**
   * Masks phone number for safe logging (e.g., +1415***671).
   * @param {string} phone
   * @returns {string}
   */
  _maskPhone(phone) {
    if (!phone || phone.length < 7) return '***';
    return phone.slice(0, 5) + '***' + phone.slice(-3);
  }
}

/**
 * Custom error class for SMS failures.
 */
class SMSError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SMSError';
    this.code = code;
  }
}

// Export singleton instance
module.exports = new SMSService();
module.exports.SMSError = SMSError;
