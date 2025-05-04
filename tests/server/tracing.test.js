/**
 * OpenTelemetry Tracing Tests
 */
const { 
  setupTracing, 
  createCustomSpan, 
  endSpan, 
  addSpanAttributes, 
  recordSpanError 
} = require('../../server/config/tracing');

// Mock OpenTelemetry SDK modules
jest.mock('@opentelemetry/sdk-node', () => {
  return {
    NodeSDK: jest.fn().mockImplementation(() => ({
      start: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('@opentelemetry/auto-instrumentations-node', () => {
  return {
    getNodeAutoInstrumentations: jest.fn().mockReturnValue([])
  };
});

jest.mock('@opentelemetry/exporter-trace-otlp-proto', () => {
  return {
    OTLPTraceExporter: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/resources', () => {
  return {
    Resource: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/semantic-conventions', () => {
  return {
    SemanticResourceAttributes: {
      SERVICE_NAME: 'service.name',
      SERVICE_VERSION: 'service.version',
      DEPLOYMENT_ENVIRONMENT: 'deployment.environment'
    }
  };
});

jest.mock('@opentelemetry/sdk-trace-base', () => {
  return {
    BatchSpanProcessor: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/instrumentation-redis', () => {
  return {
    RedisInstrumentation: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/instrumentation-mongodb', () => {
  return {
    MongoDBInstrumentation: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/instrumentation-http', () => {
  return {
    HttpInstrumentation: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/instrumentation-express', () => {
  return {
    ExpressInstrumentation: jest.fn().mockImplementation(() => ({}))
  };
});

jest.mock('@opentelemetry/api', () => {
  // Mock span
  const mockSpan = {
    end: jest.fn(),
    setAttributes: jest.fn(),
    recordException: jest.fn(),
    setStatus: jest.fn()
  };
  
  // Mock tracer
  const mockTracer = {
    startSpan: jest.fn().mockReturnValue(mockSpan)
  };
  
  return {
    trace: {
      getTracer: jest.fn().mockReturnValue(mockTracer)
    }
  };
});

// Mock Winston
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

describe('OpenTelemetry Tracing', () => {
  // Save original environment
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset environment
    process.env = { ...originalEnv };
    process.env.ENABLE_TRACING = 'true';
    
    // Clear SDK instance
    const tracing = require('../../server/config/tracing');
    tracing.__set__('sdk', undefined);
  });
  
  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });
  
  describe('setupTracing', () => {
    it('should initialize tracing when enabled', () => {
      // Setup
      process.env.ENABLE_TRACING = 'true';
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      expect(NodeSDK).toHaveBeenCalled();
      expect(NodeSDK.mock.instances[0].start).toHaveBeenCalled();
    });
    
    it('should not initialize tracing when disabled', () => {
      // Setup
      process.env.ENABLE_TRACING = 'false';
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      expect(NodeSDK).not.toHaveBeenCalled();
    });
    
    it('should configure Resource with service information', () => {
      // Setup
      process.env.npm_package_version = '1.2.3';
      process.env.NODE_ENV = 'test';
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { Resource } = require('@opentelemetry/resources');
      const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
      
      expect(Resource).toHaveBeenCalledWith({
        [SemanticResourceAttributes.SERVICE_NAME]: 'test-service',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.2.3',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'test'
      });
    });
    
    it('should configure OTLPTraceExporter with endpoint from environment', () => {
      // Setup
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
      expect(OTLPTraceExporter).toHaveBeenCalledWith(expect.objectContaining({
        url: 'http://localhost:4318/v1/traces'
      }));
    });
    
    it('should add custom headers from environment', () => {
      // Setup
      process.env.OTEL_EXPORTER_OTLP_HEADERS = JSON.stringify({
        'x-api-key': 'test-key'
      });
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
      expect(OTLPTraceExporter).toHaveBeenCalledWith(expect.objectContaining({
        headers: {
          'x-api-key': 'test-key'
        }
      }));
    });
    
    it('should configure BatchSpanProcessor with environment settings', () => {
      // Setup
      process.env.OTEL_BSP_MAX_QUEUE_SIZE = '3000';
      process.env.OTEL_BSP_MAX_EXPORT_BATCH_SIZE = '600';
      process.env.OTEL_BSP_SCHEDULE_DELAY = '6000';
      process.env.OTEL_BSP_EXPORT_TIMEOUT = '40000';
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
      expect(BatchSpanProcessor).toHaveBeenCalledWith(
        expect.anything(),  // OTLPTraceExporter
        expect.objectContaining({
          maxQueueSize: 3000,
          maxExportBatchSize: 600,
          scheduledDelayMillis: 6000,
          exportTimeoutMillis: 40000
        })
      );
    });
    
    it('should set up instrumentations', () => {
      // Execute
      setupTracing('test-service');
      
      // Verify
      const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
      const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');
      const { MongoDBInstrumentation } = require('@opentelemetry/instrumentation-mongodb');
      const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
      const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
      
      expect(getNodeAutoInstrumentations).toHaveBeenCalled();
      expect(RedisInstrumentation).toHaveBeenCalled();
      expect(MongoDBInstrumentation).toHaveBeenCalled();
      expect(HttpInstrumentation).toHaveBeenCalled();
      expect(ExpressInstrumentation).toHaveBeenCalled();
    });
    
    it('should register shutdown handler', () => {
      // Mock process.on
      const originalOn = process.on;
      const mockOn = jest.fn();
      process.on = mockOn;
      
      // Execute
      setupTracing('test-service');
      
      // Verify
      expect(mockOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      
      // Restore original
      process.on = originalOn;
    });
  });
  
  describe('createCustomSpan', () => {
    it('should create and return a span', () => {
      // Execute
      const span = createCustomSpan('test-operation');
      
      // Verify
      const api = require('@opentelemetry/api');
      expect(api.trace.getTracer).toHaveBeenCalledWith('staycrest-custom-tracer');
      expect(api.trace.getTracer().startSpan).toHaveBeenCalledWith(
        'test-operation',
        { attributes: {} },
        undefined
      );
      expect(span).toBeDefined();
    });
    
    it('should add attributes to span', () => {
      // Execute
      const span = createCustomSpan('test-operation', { key: 'value' });
      
      // Verify
      const api = require('@opentelemetry/api');
      expect(api.trace.getTracer().startSpan).toHaveBeenCalledWith(
        'test-operation',
        { attributes: { key: 'value' } },
        undefined
      );
    });
    
    it('should handle errors gracefully', () => {
      // Setup
      const api = require('@opentelemetry/api');
      api.trace.getTracer.mockImplementationOnce(() => {
        throw new Error('Tracer error');
      });
      
      // Execute
      const span = createCustomSpan('test-operation');
      
      // Verify
      expect(span).toBeNull();
    });
  });
  
  describe('endSpan', () => {
    it('should end a span', () => {
      // Setup
      const mockSpan = { end: jest.fn() };
      
      // Execute
      endSpan(mockSpan);
      
      // Verify
      expect(mockSpan.end).toHaveBeenCalled();
    });
    
    it('should handle null spans gracefully', () => {
      // Execute - this should not throw
      endSpan(null);
    });
    
    it('should handle errors gracefully', () => {
      // Setup
      const mockSpan = { 
        end: jest.fn().mockImplementation(() => {
          throw new Error('End span error');
        }) 
      };
      
      // Execute - this should not throw
      endSpan(mockSpan);
    });
  });
  
  describe('addSpanAttributes', () => {
    it('should add attributes to a span', () => {
      // Setup
      const mockSpan = { setAttributes: jest.fn() };
      const attributes = { key1: 'value1', key2: 42 };
      
      // Execute
      addSpanAttributes(mockSpan, attributes);
      
      // Verify
      expect(mockSpan.setAttributes).toHaveBeenCalledWith(attributes);
    });
    
    it('should handle null spans gracefully', () => {
      // Execute - this should not throw
      addSpanAttributes(null, { key: 'value' });
    });
    
    it('should handle errors gracefully', () => {
      // Setup
      const mockSpan = { 
        setAttributes: jest.fn().mockImplementation(() => {
          throw new Error('Add attributes error');
        }) 
      };
      
      // Execute - this should not throw
      addSpanAttributes(mockSpan, { key: 'value' });
    });
  });
  
  describe('recordSpanError', () => {
    it('should record an error on a span', () => {
      // Setup
      const mockSpan = { 
        recordException: jest.fn(),
        setStatus: jest.fn()
      };
      const error = new Error('Test error');
      
      // Execute
      recordSpanError(mockSpan, error);
      
      // Verify
      expect(mockSpan.recordException).toHaveBeenCalledWith(error);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ 
        code: 2,  // ERROR
        message: 'Test error' 
      });
    });
    
    it('should handle null spans or errors gracefully', () => {
      // Execute - these should not throw
      recordSpanError(null, new Error('Test'));
      recordSpanError({}, null);
    });
    
    it('should handle recording errors gracefully', () => {
      // Setup
      const mockSpan = { 
        recordException: jest.fn().mockImplementation(() => {
          throw new Error('Record error exception');
        }),
        setStatus: jest.fn()
      };
      const error = new Error('Test error');
      
      // Execute - this should not throw
      recordSpanError(mockSpan, error);
    });
  });
}); 