/**
 * Error Handler Middleware
 * 
 * Centralized error handling with proper logging and response formatting.
 * This middleware handles all errors thrown in the application, providing
 * appropriate HTTP status codes and error messages to clients.
 */

const winston = require('winston');
const analyticsService = require('../services/analytics-service');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'error-handler' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/errors.log' })
  ],
});

/**
 * Custom error class for HTTP errors
 */
class HttpError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || `ERR_${statusCode}`;
    this.isOperational = true;
  }
}

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  const correlationId = req.correlationId || 'unknown';
  
  // Determine status code and create structured error object
  const statusCode = err.statusCode || err.status || 500;
  
  // For client errors (4xx), log at warning level; otherwise error level
  const isClientError = statusCode >= 400 && statusCode < 500;
  const logLevel = isClientError ? 'warn' : 'error';
  
  // Create structured error response
  const errorResponse = {
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || `ERR_${statusCode}`,
      status: statusCode,
      correlationId
    }
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    errorResponse.error.stack = err.stack.split('\n');
  }
  
  // Add additional error details if available
  if (err.details) {
    errorResponse.error.details = err.details;
  }
  
  // Log the error with context
  const logData = {
    correlationId,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    userAgent: req.get('user-agent') || 'unknown',
    stack: err.stack,
    code: err.code,
    isOperational: err.isOperational || false
  };
  
  // Use request logger if available (includes correlation ID)
  const requestLogger = req.logger || logger;
  requestLogger[logLevel](`${req.method} ${req.path} - ${err.message}`, logData);
  
  // Track error in analytics
  analyticsService.trackError(err, { 
    path: req.path, 
    method: req.method,
    correlationId,
    statusCode,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });
  
  // Send response
  res.status(statusCode).json(errorResponse);
};

/**
 * Function to create specific HTTP errors
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @returns {HttpError} - Custom HTTP error
 */
const createHttpError = (message, statusCode = 500, code) => {
  return new HttpError(message, statusCode, code);
};

// Create specific error types
const notFoundError = (message = 'Resource not found') => 
  createHttpError(message, 404, 'ERR_NOT_FOUND');

const validationError = (message = 'Validation failed', details) => {
  const error = createHttpError(message, 400, 'ERR_VALIDATION');
  error.details = details;
  return error;
};

const unauthorizedError = (message = 'Unauthorized access') =>
  createHttpError(message, 401, 'ERR_UNAUTHORIZED');

const forbiddenError = (message = 'Forbidden access') =>
  createHttpError(message, 403, 'ERR_FORBIDDEN');

const internalServerError = (message = 'Internal server error') =>
  createHttpError(message, 500, 'ERR_INTERNAL');

module.exports = { 
  errorHandler,
  createHttpError,
  notFoundError,
  validationError,
  unauthorizedError,
  forbiddenError,
  internalServerError,
  HttpError
}; 