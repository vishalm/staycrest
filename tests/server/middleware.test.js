/**
 * Middleware Tests
 * 
 * Tests for the various middleware components including:
 * 1. Correlation ID middleware
 * 2. Error handling middleware
 * 3. Security headers middleware
 * 4. Metrics middleware
 */
const correlationIdMiddleware = require('../../server/middleware/correlation-id').correlationIdMiddleware;
const { 
  errorHandler, 
  createHttpError, 
  notFoundError,
  validationError,
  unauthorizedError,
  forbiddenError,
  internalServerError
} = require('../../server/middleware/error-handler');
const { securityHeaders } = require('../../server/middleware/security-headers');
const { 
  metricsMiddleware, 
  getMetricsRegistry, 
  recordBusinessMetric 
} = require('../../server/middleware/metrics-middleware');

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid')
}));

// Mock Winston
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn()
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn()
  }
}));

// Mock Analytics Service
jest.mock('../../server/services/analytics-service', () => ({
  trackError: jest.fn(),
  trackEvent: jest.fn()
}));

// Mock Prometheus client
jest.mock('prom-client', () => {
  const mockCounter = {
    inc: jest.fn(),
    labels: jest.fn(() => mockCounter)
  };
  
  const mockGauge = {
    set: jest.fn(),
    labels: jest.fn(() => mockGauge)
  };
  
  return {
    Counter: jest.fn(() => mockCounter),
    Gauge: jest.fn(() => mockGauge),
    register: {
      registerMetric: jest.fn(),
      contentType: 'text/plain',
      metrics: jest.fn(() => 'mock-metrics-data')
    }
  };
});

// Mock OS module
jest.mock('os', () => ({
  cpus: jest.fn(() => Array(4).fill({
    times: { idle: 1000, user: 2000, sys: 500, nice: 100, irq: 50 }
  })),
  totalmem: jest.fn(() => 16 * 1024 * 1024 * 1024),
  freemem: jest.fn(() => 8 * 1024 * 1024 * 1024)
}));

describe('Middleware', () => {
  describe('Correlation ID Middleware', () => {
    it('should generate a correlation ID if not provided', () => {
      // Setup
      const req = { headers: {} };
      const res = { set: jest.fn() };
      const next = jest.fn();
      
      // Execute
      correlationIdMiddleware(req, res, next);
      
      // Verify
      expect(req.correlationId).toBe('mocked-uuid');
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'mocked-uuid');
      expect(next).toHaveBeenCalled();
    });
    
    it('should use existing correlation ID from headers', () => {
      // Setup
      const req = { headers: { 'x-correlation-id': 'existing-id' } };
      const res = { set: jest.fn() };
      const next = jest.fn();
      
      // Execute
      correlationIdMiddleware(req, res, next);
      
      // Verify
      expect(req.correlationId).toBe('existing-id');
      expect(res.set).toHaveBeenCalledWith('X-Correlation-ID', 'existing-id');
      expect(next).toHaveBeenCalled();
    });
    
    it('should attach a logger with correlation ID context', () => {
      // Setup
      const req = { headers: {} };
      const res = { set: jest.fn() };
      const next = jest.fn();
      
      // Execute
      correlationIdMiddleware(req, res, next);
      
      // Verify
      expect(req.logger).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('Error Handler Middleware', () => {
    it('should handle operational errors with correct status code', () => {
      // Setup
      const err = createHttpError('Not found', 404, 'ERR_NOT_FOUND');
      const req = { 
        correlationId: 'test-id',
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn(() => 'test-agent')
      };
      const res = { 
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();
      
      // Execute
      errorHandler(err, req, res, next);
      
      // Verify
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'Not found',
          code: 'ERR_NOT_FOUND',
          status: 404,
          correlationId: 'test-id'
        })
      }));
    });
    
    it('should handle internal server errors with 500 status code', () => {
      // Setup
      const err = new Error('Something went wrong');
      const req = { 
        correlationId: 'test-id',
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn(() => 'test-agent')
      };
      const res = { 
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();
      
      // Execute
      errorHandler(err, req, res, next);
      
      // Verify
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          message: 'Something went wrong',
          status: 500,
          correlationId: 'test-id'
        })
      }));
    });
    
    it('should include stack trace in development environment', () => {
      // Setup
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const err = new Error('Something went wrong');
      err.stack = 'Error: Something went wrong\n    at test.js:1:1';
      
      const req = { 
        correlationId: 'test-id',
        path: '/test',
        method: 'GET',
        ip: '127.0.0.1',
        get: jest.fn(() => 'test-agent')
      };
      const res = { 
        status: jest.fn(() => res),
        json: jest.fn()
      };
      const next = jest.fn();
      
      // Execute
      errorHandler(err, req, res, next);
      
      // Verify
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          stack: expect.any(Array)
        })
      }));
      
      // Restore environment
      process.env.NODE_ENV = originalNodeEnv;
    });
    
    it('should create specific HTTP errors', () => {
      // Validation error
      const vError = validationError('Invalid input', { field: 'error details' });
      expect(vError.statusCode).toBe(400);
      expect(vError.code).toBe('ERR_VALIDATION');
      expect(vError.details).toEqual({ field: 'error details' });
      
      // Not found error
      const nfError = notFoundError('Resource not found');
      expect(nfError.statusCode).toBe(404);
      expect(nfError.code).toBe('ERR_NOT_FOUND');
      
      // Unauthorized error
      const uaError = unauthorizedError('Login required');
      expect(uaError.statusCode).toBe(401);
      expect(uaError.code).toBe('ERR_UNAUTHORIZED');
      
      // Forbidden error
      const fbError = forbiddenError('Access denied');
      expect(fbError.statusCode).toBe(403);
      expect(fbError.code).toBe('ERR_FORBIDDEN');
      
      // Internal server error
      const isError = internalServerError('Server error');
      expect(isError.statusCode).toBe(500);
      expect(isError.code).toBe('ERR_INTERNAL');
    });
  });
  
  describe('Security Headers Middleware', () => {
    it('should include proper security headers', () => {
      // Verify CSP directives
      expect(securityHeaders.contentSecurityPolicy).toBeDefined();
      expect(securityHeaders.contentSecurityPolicy.directives).toBeDefined();
      
      // Verify HSTS configuration
      expect(securityHeaders.hsts).toBeDefined();
      expect(securityHeaders.hsts.maxAge).toBeGreaterThan(0);
      expect(securityHeaders.hsts.includeSubDomains).toBe(true);
      
      // Verify other security headers
      expect(securityHeaders.frameguard).toBeDefined();
      expect(securityHeaders.contentTypeOptions).toBe(true);
      expect(securityHeaders.xssFilter).toBe(true);
      expect(securityHeaders.referrerPolicy).toBeDefined();
      expect(securityHeaders.hidePoweredBy).toBe(true);
    });
    
    it('should have different CSP settings based on environment', () => {
      // Get CSP config function
      const getCspConfig = require('../../server/middleware/security-headers').getCspConfig;
      
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Test production environment
      process.env.NODE_ENV = 'production';
      const prodDirectives = getCspConfig();
      expect(prodDirectives.upgradeInsecureRequests).toBeDefined();
      
      // Test development environment
      process.env.NODE_ENV = 'development';
      const devDirectives = getCspConfig();
      expect(devDirectives.scriptSrc).toContain("'unsafe-inline'");
      expect(devDirectives.scriptSrc).toContain("'unsafe-eval'");
      expect(devDirectives.upgradeInsecureRequests).toBeUndefined();
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
  
  describe('Metrics Middleware', () => {
    it('should track API version usage', () => {
      // Setup
      const req = {
        apiVersion: 'v1',
        route: { path: '/test' },
        method: 'GET',
        baseUrl: '/api',
        originalUrl: '/api/test?query=1'
      };
      const res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };
      const next = jest.fn();
      
      // Execute
      metricsMiddleware(req, res, next);
      
      // Verify
      expect(next).toHaveBeenCalled();
      
      // Since the metrics are collected on 'finish' event, which we trigger immediately,
      // we should expect the counters to be updated
      const mockPrometheus = require('prom-client');
      expect(mockPrometheus.Counter().labels().inc).toHaveBeenCalled();
    });
    
    it('should track business metrics for search operations', () => {
      // Setup
      const req = {
        apiVersion: 'v1',
        route: { path: '/hotels/search' },
        method: 'GET',
        baseUrl: '/api/v1',
        originalUrl: '/api/v1/hotels/search?location=New+York',
        query: {},
        body: { filters: { price: 'high' } }
      };
      const res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };
      const next = jest.fn();
      
      // Execute
      metricsMiddleware(req, res, next);
      
      // Verify
      expect(next).toHaveBeenCalled();
      
      // Verify business metrics were recorded
      const mockPrometheus = require('prom-client');
      expect(mockPrometheus.Counter().labels().inc).toHaveBeenCalled();
    });
    
    it('should track business metrics for login operations', () => {
      // Setup
      const req = {
        apiVersion: 'v1',
        route: { path: '/auth/login' },
        method: 'POST',
        baseUrl: '/api/v1',
        originalUrl: '/api/v1/auth/login',
        body: { username: 'test', password: 'password', provider: 'email' }
      };
      const res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };
      const next = jest.fn();
      
      // Execute
      metricsMiddleware(req, res, next);
      
      // Verify
      expect(next).toHaveBeenCalled();
      
      // Verify business metrics were recorded
      const mockPrometheus = require('prom-client');
      expect(mockPrometheus.Counter().labels().inc).toHaveBeenCalled();
    });
    
    it('should collect system metrics', () => {
      // Call the system metrics collection function directly
      const collectSystemMetrics = require('../../server/middleware/metrics-middleware').__get__('collectSystemMetrics');
      collectSystemMetrics();
      
      // Verify gauges were set
      const mockPrometheus = require('prom-client');
      expect(mockPrometheus.Gauge().set).toHaveBeenCalled();
      expect(mockPrometheus.Gauge().labels().set).toHaveBeenCalled();
    });
    
    it('should provide metrics registry', () => {
      const registry = getMetricsRegistry();
      expect(registry).toBeDefined();
      expect(registry.metrics).toBeDefined();
    });
    
    it('should record custom business metrics', () => {
      // Record a hotel search metric
      recordBusinessMetric('hotel_search', { filters_used: 'yes' });
      
      // Record a login metric
      recordBusinessMetric('user_login', { success: true, provider: 'google' });
      
      // Record an unknown metric (should warn)
      recordBusinessMetric('unknown_metric');
      
      // Verify counters were incremented
      const mockPrometheus = require('prom-client');
      expect(mockPrometheus.Counter().labels().inc).toHaveBeenCalled();
    });
  });
}); 