
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.OTP_LENGTH = '6';
process.env.OTP_EXPIRY_MINUTES = '2';
process.env.OTP_MAX_ATTEMPTS = '3';
process.env.OTP_RESEND_COOLDOWN_SECONDS = '30';
process.env.APP_NAME = 'test-service';

// Mock SMS service — no real Twilio calls in tests
jest.mock('./services/sms.service', () => ({
  sendOTP: jest.fn().mockResolvedValue({
    success: true, mock: true, messageId: 'test_msg_id'
  }),
}));

const OTP        = require('./models/otp.model');
const jwtService = require('./services/jwt.services');

// ─────────────────────────────────────────────
describe('OTP Model — generateCode()', () => {
  it('generates a numeric string of correct length', () => {
    const code = OTP.generateCode(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generates different codes on subsequent calls', () => {
    const codes = new Set();
    for (let i = 0; i < 10; i++) codes.add(OTP.generateCode(6));
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────
describe('OTP Model — hashCode()', () => {
  it('produces a consistent SHA-256 hash', () => {
    const hash1 = OTP.hashCode('123456');
    const hash2 = OTP.hashCode('123456');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('produces different hashes for different codes', () => {
    expect(OTP.hashCode('123456')).not.toBe(OTP.hashCode('654321'));
  });
});

// ─────────────────────────────────────────────
describe('OTP Instance Methods', () => {
  let otpDoc;

  beforeEach(() => {
    otpDoc = new OTP({
      phoneNumber: '+14155552671',
      codeHash:    OTP.hashCode('123456'),
      expiresAt:   new Date(Date.now() + 2 * 60 * 1000),
      maxAttempts: 3,
    });
  });

  describe('isExpired()', () => {
    it('returns false for a future expiry', () => {
      expect(otpDoc.isExpired()).toBe(false);
    });

    it('returns true for a past expiry', () => {
      otpDoc.expiresAt = new Date(Date.now() - 1000);
      expect(otpDoc.isExpired()).toBe(true);
    });
  });

  describe('isExhausted()', () => {
    it('returns false when attempts < maxAttempts', () => {
      otpDoc.attempts = 2;
      expect(otpDoc.isExhausted()).toBe(false);
    });

    it('returns true when attempts >= maxAttempts', () => {
      otpDoc.attempts = 3;
      expect(otpDoc.isExhausted()).toBe(true);
    });
  });

  describe('verifyCode()', () => {
    it('returns true for correct code',    () => expect(otpDoc.verifyCode('123456')).toBe(true));
    it('returns false for incorrect code', () => expect(otpDoc.verifyCode('000000')).toBe(false));
    it('returns false for empty code',     () => expect(otpDoc.verifyCode('')).toBe(false));
  });
});

// ─────────────────────────────────────────────
describe('JWT Service', () => {
  it('generates and verifies a valid token', () => {
    const mockUser = {
      _id:             { toString: () => 'user123' },
      phoneNumber:     '+14155552671',
      isPhoneVerified: true,
    };

    const token = jwtService.generateToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const result = jwtService.verifyToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload.sub).toBe('user123');
    expect(result.payload.phone).toBe('+14155552671');
  });

  it('rejects an invalid token', () => {
    const result = jwtService.verifyToken('invalid.token.here');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('extracts token from Bearer header', () => {
    expect(jwtService.extractFromHeader('Bearer mytoken123')).toBe('mytoken123');
  });

  it('returns null for missing or malformed header', () => {
    expect(jwtService.extractFromHeader(null)).toBeNull();
    expect(jwtService.extractFromHeader('Token abc')).toBeNull();
    expect(jwtService.extractFromHeader('')).toBeNull();
  });
});