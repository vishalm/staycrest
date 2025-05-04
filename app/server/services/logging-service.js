const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, json, printf } = format;

/**
 * Centralized Logging Service for StayCrest application
 * Compatible with ELK stack for log aggregation and analysis
 */
class LoggingService {
  constructor() {
    this.loggers = {};
    this.defaultLevel = process.env.LOG_LEVEL || 'info';
    this.appName = 'staycrest';
    this.environment = process.env.NODE_ENV || 'development';
    
    // Create default formatter for console
    this.consoleFormat = combine(
      format.colorize(),
      timestamp(),
      printf(({ level, message, timestamp, ...metadata }) => {
        const metaStr = Object.keys(metadata).length 
          ? `\n${JSON.stringify(metadata, null, 2)}` 
          : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    );
    
    // Create ELK compatible format with all fields flattened
    this.elkFormat = combine(
      timestamp(),
      format((info) => {
        info.app = this.appName;
        info.env = this.environment;
        info.host = require('os').hostname();
        return info;
      })(),
      json()
    );
    
    // Create default logger
    this.getLogger('app');
  }
  
  /**
   * Get or create a logger instance for a specific component
   * @param {string} component - Component name (e.g., 'search', 'auth', 'api')
   * @param {string} level - Log level (default: from env or 'info')
   * @returns {winston.Logger} - Winston logger instance
   */
  getLogger(component, level = this.defaultLevel) {
    if (this.loggers[component]) {
      return this.loggers[component];
    }
    
    const logger = createLogger({
      level,
      defaultMeta: { component },
      format: this.elkFormat,
      transports: [
        // File transport for ELK consumption
        new transports.File({ 
          filename: `logs/${component}.log`,
          level
        }),
        // Console transport for development
        new transports.Console({
          level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
          format: this.consoleFormat
        })
      ]
    });
    
    this.loggers[component] = logger;
    return logger;
  }
  
  /**
   * Log a structured event with metrics and context
   * @param {string} component - Component name
   * @param {string} level - Log level (info, error, warn, debug)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   * @param {Object} metrics - Metrics data to log
   */
  logEvent(component, level, message, data = {}, metrics = {}) {
    const logger = this.getLogger(component);
    
    logger[level](message, {
      ...data,
      event: true,
      metrics
    });
  }
  
  /**
   * Log an error with stack trace and context
   * @param {string} component - Component name
   * @param {Error} error - Error object
   * @param {string} message - Optional custom message
   * @param {Object} context - Additional context
   */
  logError(component, error, message = null, context = {}) {
    const logger = this.getLogger(component);
    
    logger.error(message || error.message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context
    });
  }
  
  /**
   * Create child logger with predefined context
   * @param {string} component - Component name
   * @param {Object} defaultContext - Default context to include in all logs
   * @returns {Object} - Child logger interface
   */
  createChildLogger(component, defaultContext = {}) {
    const parentLogger = this.getLogger(component);
    
    return {
      debug: (message, context = {}) => {
        parentLogger.debug(message, { ...defaultContext, ...context });
      },
      info: (message, context = {}) => {
        parentLogger.info(message, { ...defaultContext, ...context });
      },
      warn: (message, context = {}) => {
        parentLogger.warn(message, { ...defaultContext, ...context });
      },
      error: (message, context = {}) => {
        parentLogger.error(message, { ...defaultContext, ...context });
      },
      logEvent: (level, message, data = {}, metrics = {}) => {
        this.logEvent(component, level, message, { ...defaultContext, ...data }, metrics);
      },
      logError: (error, message = null, additionalContext = {}) => {
        this.logError(component, error, message, { ...defaultContext, ...additionalContext });
      }
    };
  }
  
  /**
   * Get available loggers
   * @returns {Object} - Map of logger names
   */
  getLoggers() {
    return Object.keys(this.loggers).reduce((acc, key) => {
      acc[key] = {
        level: this.loggers[key].level
      };
      return acc;
    }, {});
  }
  
  /**
   * Set log level for a specific component
   * @param {string} component - Component name
   * @param {string} level - New log level
   */
  setLogLevel(component, level) {
    if (this.loggers[component]) {
      this.loggers[component].level = level;
      
      // Update transports
      this.loggers[component].transports.forEach(t => {
        t.level = level;
      });
      
      return true;
    }
    return false;
  }
}

// Export singleton instance
module.exports = new LoggingService(); 