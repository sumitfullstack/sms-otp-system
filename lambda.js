const serverless = require('serverless-http');
const app = require('./app');
const connectDB = require('./config/database');
const logger = require('./config/logger');

// Cache DB connection across warm Lambda invocations
let isConnected = false;

const handler = serverless(app, {
  // Transform API Gateway event before passing to Express
  request: (req) => {
    req.serverless = true;
  },
});

/**
 * Main Lambda handler function.
 * Ensures DB is connected before processing each request.
 */
module.exports.handler = async (event, context) => {
  // Prevent Lambda from waiting for the event loop to be empty
  context.callbackWaitsForEmptyEventLoop = false;

  // Reuse existing DB connection across warm starts
  if (!isConnected) {
    try {
      await connectDB();
      isConnected = true;
    } catch (error) {
      logger.error('Lambda: DB connection failed', error);
      return {
        statusCode: 503,
        body: JSON.stringify({ success: false, message: 'Service temporarily unavailable' }),
      };
    }
  }

  return handler(event, context);
};
