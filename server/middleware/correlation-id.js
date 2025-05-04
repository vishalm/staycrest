/**
 * Correlation ID Middleware
 * 
 * This middleware adds a correlation ID to each request to enable request tracing
 * throughout the system. It accepts an existing correlation ID from request headers
 * or generates a new one.
 */

const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'correlation-middleware' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/correlation.log' })
  ],
});

/**
 * Middleware to ensure each request has a correlation ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const correlationIdMiddleware = (req, res, next) => {
  // Check for existing correlation ID in headers
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  // Attach correlation ID to request
  req.correlationId = correlationId;
  
  // Add correlation ID to response headers
  res.set('X-Correlation-ID', correlationId);
  
  // Add correlation ID to logger context
  const loggerWithContext = winston.createLogger({
    level: logger.level,
    format: logger.format,
    defaultMeta: { 
      service: 'staycrest-api',
      correlationId 
    },
    transports: logger.transports
  });
  
  // Attach logger to request
  req.logger = loggerWithContext;
  
  logger.debug('Correlation ID set', { correlationId, path: req.path });
  
  next();
};

module.exports = { correlationIdMiddleware }; 