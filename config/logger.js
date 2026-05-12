const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors, json } = format;

const isProduction = process.env.NODE_ENV === 'production';

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level}]: ${stack || message}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: isProduction ? prodFormat : devFormat,
  transports: [new transports.Console()],
  exitOnError: false,
});

logger.http = (message) => logger.verbose(message);

module.exports = logger;