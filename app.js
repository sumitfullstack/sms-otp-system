require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const connectDB      = require('./config/database');
const logger         = require('./config/logger');
const { globalRateLimiter } = require('./middleware/ratelimiter');
const errorHandler   = require('./middleware/error.handler');
const authRoutes     = require('./routes/auth.routes');
const otpRoutes      = require('./routes/otp.routes');
const userRoutes     = require('./routes/user.routes');

const app = express();

// --- Helmet (disable CSP so frontend fetch() calls work locally) ---
app.use(helmet({ contentSecurityPolicy: false }));

// --- CORS ---
app.use(cors({
  origin: '*',          // open for local dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// --- Body Parsing ---
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// --- Logging ---
app.use(morgan('dev'));

// --- Rate Limiting ---
app.use(globalRateLimiter);

// Welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'SMS OTP Verification API',
    version: '1.0.0',
    endpoints: {
      health:     'GET  /health',
      sendOTP:    'POST /api/v1/otp/send',
      verifyOTP:  'POST /api/v1/otp/verify',
      profile:    'GET  /api/v1/user/me',
    }
  });
});

// --- Serve Frontend ---
app.use(express.static(path.join(__dirname, 'frontend')));


// --- Health Check ---
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: process.env.APP_NAME || 'SMS-OTP-Service',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// --- API Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/otp',  otpRoutes);
app.use('/api/v1/user', userRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Start Server ---
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
      logger.info(`🌐 Frontend: http://localhost:${PORT}`);
      logger.info(`🔗 API:      http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  startServer();
}

module.exports = app;