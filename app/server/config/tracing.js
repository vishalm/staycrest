/**
 * OpenTelemetry Configuration
 * 
 * Configures distributed tracing using OpenTelemetry.
 */

const winston = require('winston');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');
const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'tracing-config' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/tracing.log' })
  ],
});

// Add error method to logger
logger.error = (message, meta) => {
  logger.log('error', message, meta);
};

let sdk;

/**
 * Setup OpenTelemetry tracing
 * @param {string} serviceName - Name of the service
 */
function setupTracing(serviceName) {
  // Skip if disabled or already initialized
  if (process.env.ENABLE_TRACING !== 'true' || sdk) {
    if (process.env.ENABLE_TRACING !== 'true') {
      logger.info('Tracing is disabled by configuration');
    } else if (sdk) {
      logger.info('Tracing is already initialized');
    }
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      });
      
      // Configure OTLP exporter
      const exporterOptions = {
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
        headers: {},
      };
      
      // Add custom headers if configured
      if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
        try {
          const headers = JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS);
          Object.assign(exporterOptions.headers, headers);
        } catch (error) {
          logger.error('Failed to parse OTEL_EXPORTER_OTLP_HEADERS', { error });
        }
      }
      
      // Create trace exporter
      const traceExporter = new OTLPTraceExporter(exporterOptions);
      
      // Create span processor
      const spanProcessor = new BatchSpanProcessor(traceExporter, {
        // Configure batch processing
        maxQueueSize: parseInt(process.env.OTEL_BSP_MAX_QUEUE_SIZE || '2048'),
        maxExportBatchSize: parseInt(process.env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE || '512'),
        scheduledDelayMillis: parseInt(process.env.OTEL_BSP_SCHEDULE_DELAY || '5000'),
        exportTimeoutMillis: parseInt(process.env.OTEL_BSP_EXPORT_TIMEOUT || '30000'),
      });
      
      // Configure auto-instrumentations
      const instrumentations = getNodeAutoInstrumentations({
        // Configure specific instrumentations
        '@opentelemetry/instrumentation-fs': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-mongodb': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
      });
      
      // Add custom instrumentations
      instrumentations.push(
        new RedisInstrumentation({
          requireParentSpan: true,
          detailedCommands: true,
        }),
        new MongoDBInstrumentation({
          enhancedDatabaseReporting: true,
        }),
        new HttpInstrumentation({
          ignoreIncomingPaths: ['/health', '/metrics'],
        }),
        new ExpressInstrumentation({
          ignoreLayers: ['/health', '/metrics'],
        })
      );
      
      // Create SDK
      sdk = new NodeSDK({
        resource,
        spanProcessor,
        instrumentations,
      });
      
      // Start the SDK
      sdk.start()
        .then(() => {
          logger.info('Tracing initialized successfully');
          resolve();
        })
        .catch((error) => {
          logger.error('Failed to initialize tracing', { error });
          reject(error);
        });
    } catch (error) {
      logger.error('Failed to setup tracing', { error });
      reject(error);
    }
  });
}

/**
 * Create a custom span
 * @param {string} name - Span name
 * @param {Object} attributes - Span attributes
 * @param {Object} context - Trace context
 * @returns {Object} - Created span
 */
function createCustomSpan(name, attributes = {}, context = undefined) {
  try {
    const api = require('@opentelemetry/api');
    const tracer = api.trace.getTracer('staycrest-custom-tracer');
    
    return tracer.startSpan(name, { attributes }, context);
  } catch (error) {
    logger.error(`Failed to create custom span: ${error.message}`, { error, name });
    return null;
  }
}

/**
 * End a span
 * @param {Object} span - The span to end
 */
function endSpan(span) {
  if (span) {
    try {
      span.end();
    } catch (error) {
      logger.error(`Failed to end span: ${error.message}`, { error });
    }
  }
}

/**
 * Add attributes to a span
 * @param {Object} span - The span to update
 * @param {Object} attributes - Attributes to add
 */
function addSpanAttributes(span, attributes) {
  if (span) {
    try {
      span.setAttributes(attributes);
    } catch (error) {
      logger.error(`Failed to add span attributes: ${error.message}`, { error });
    }
  }
}

/**
 * Record an error in a span
 * @param {Object} span - The span to record the error in
 * @param {Error} error - The error to record
 */
function recordSpanError(span, error) {
  if (span && error) {
    try {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // 2 = ERROR
    } catch (err) {
      logger.error(`Failed to record span error: ${err.message}`, { error: err });
    }
  }
}

module.exports = {
  setupTracing,
  createCustomSpan,
  endSpan,
  addSpanAttributes,
  recordSpanError,
}; 