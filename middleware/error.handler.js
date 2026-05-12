
const logger = require('../config/logger');

/**
 * Maps known error types to appropriate HTTP status codes.
 */
const getStatusCode = (err) => {
  if (err.statusCode) return err.statusCode;
  if (err.status) return err.status;

  // Mongoose validation errors
  if (err.name === 'ValidationError') return 422;

  // Mongoose duplicate key
  if (err.code === 11000) return 409;

  // JWT errors
  if (err.name === 'JsonWebTokenError') return 401;
  if (err.name === 'TokenExpiredError') return 401;

  // CORS
  if (err.message?.includes('CORS')) return 403;

  return 500;
};

/**
 * Extracts a user-friendly message from the error.
 */
const getErrorMessage = (err, statusCode) => {
  // Don't leak internal error details in production
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    return 'An unexpected error occurred. Please try again later.';
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return field ? `${field} already exists.` : 'Duplicate entry.';
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return messages.join(' ');
  }

  return err.message || 'An error occurred.';
};

/**
 * Global error handler — must be last middleware in the stack.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = getStatusCode(err);
  const message = getErrorMessage(err, statusCode);

  // Log 5xx errors with full stack trace
  if (statusCode >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn(`${statusCode} ${message} — ${req.method} ${req.originalUrl}`);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err,
    }),
  });
};

module.exports = errorHandler;
