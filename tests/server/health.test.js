/**
 * Health Check Routes Tests
 */
// Polyfill TextEncoder and TextDecoder for Node.js environment in Jest
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { router, startTime } = require('../../server/routes/health');
const workerThreadManager = require('../../server/services/worker-thread-manager');

// Mock dependencies
jest.mock('mongoose', () => ({
  connection: {
    readyState: 1  // Connected by default
  }
}));

jest.mock('../../server/services/worker-thread-manager', () => ({
  getStats: jest.fn(() => ({
    initialized: true,
    workers: {
      total: 4,
      busy: 1,
      available: 3
    },
    queue: {
      current: 2,
      max: 10
    },
    tasks: {
      queued: 100,
      completed: 98,
      rejected: 0,
      avgProcessingTime: '50ms'
    }
  }))
}));

jest.mock('../../package.json', () => ({
  version: '1.0.0'
}), { virtual: true });

describe('Health Check Routes', () => {
  let app;
  
  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use('/api/health', router);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock app.get for Redis client
    app.get = jest.fn((key) => {
      if (key === 'redisClient') {
        return { isReady: true };
      }
      return null;
    });
  });
  
  describe('GET /', () => {
    it('should return 200 OK with basic health check', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String)
      });
    });
  });
  
  describe('GET /liveness', () => {
    it('should return 200 OK with uptime information', async () => {
      const response = await request(app)
        .get('/api/health/liveness')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String)
      });
      
      // Uptime should be calculated correctly
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('GET /readiness', () => {
    it('should return 200 OK when all dependencies are ready', async () => {
      // Setup mocks for ready state
      mongoose.connection.readyState = 1;  // Connected
      
      const response = await request(app)
        .get('/api/health/readiness')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        dependencies: {
          mongodb: 'connected',
          redis: 'connected',
          workerThreads: 'ready'
        }
      });
    });
    
    it('should return 503 Service Unavailable when MongoDB is not ready', async () => {
      // Setup mocks for not ready state
      mongoose.connection.readyState = 0;  // Disconnected
      
      const response = await request(app)
        .get('/api/health/readiness')
        .expect('Content-Type', /json/)
        .expect(503);
      
      expect(response.body).toEqual({
        status: 'not_ready',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        dependencies: {
          mongodb: 'disconnected',
          redis: 'connected',
          workerThreads: 'ready'
        }
      });
    });
    
    it('should return 503 Service Unavailable when Redis is not ready', async () => {
      // Setup mocks for not ready state
      app.get = jest.fn((key) => {
        if (key === 'redisClient') {
          return { isReady: false };
        }
        return null;
      });
      
      const response = await request(app)
        .get('/api/health/readiness')
        .expect('Content-Type', /json/)
        .expect(503);
      
      expect(response.body).toEqual({
        status: 'not_ready',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        dependencies: {
          mongodb: 'disconnected',
          redis: 'disconnected',
          workerThreads: 'ready'
        }
      });
    });
    
    it('should return 503 Service Unavailable when worker thread manager is not ready', async () => {
      // Setup mocks for not ready state
      workerThreadManager.getStats.mockReturnValueOnce({
        initialized: false,
        workers: { total: 0 }
      });
      
      const response = await request(app)
        .get('/api/health/readiness')
        .expect('Content-Type', /json/)
        .expect(503);
      
      expect(response.body).toEqual({
        status: 'not_ready',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        dependencies: {
          mongodb: 'disconnected',
          redis: 'connected',
          workerThreads: 'not_ready'
        }
      });
    });
  });
  
  describe('GET /startup', () => {
    it('should return 200 OK when all initialization is complete', async () => {
      // Setup mocks for ready state
      mongoose.connection.readyState = 1;  // Connected
      
      const response = await request(app)
        .get('/api/health/startup')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        dependencies: {
          mongodb: 'connected',
          redis: 'connected',
          workerThreads: 'ready'
        }
      });
    });
    
    it('should return 503 Service Unavailable when initialization is not complete', async () => {
      // Setup mocks for not ready state
      mongoose.connection.readyState = 2;  // Connecting
      
      const response = await request(app)
        .get('/api/health/startup')
        .expect('Content-Type', /json/)
        .expect(503);
      
      expect(response.body).toEqual({
        status: 'initializing',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        dependencies: {
          mongodb: 'disconnected',
          redis: 'connected',
          workerThreads: 'ready'
        }
      });
    });
    
    it('should handle errors gracefully', async () => {
      // Setup mocks to throw error
      mongoose.connection.readyState = undefined;  // Will cause error
      console.error = jest.fn();  // Mock console.error
      
      const response = await request(app)
        .get('/api/health/startup')
        .expect('Content-Type', /json/)
        .expect(503);
      
      expect(response.body.status).toBe('initializing');
      expect(response.body.uptime).toEqual(expect.any(Number));
      expect(response.body.service).toBe('staycrest-api');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.timestamp).toEqual(expect.any(String));
      expect(response.body.dependencies).toBeDefined();
    });
  });
  
  describe('GET /system', () => {
    it('should return detailed system information', async () => {
      const response = await request(app)
        .get('/api/health/system')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        uptime: expect.any(Number),
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        system: {
          hostname: expect.any(String),
          platform: expect.any(String),
          arch: expect.any(String),
          cpus: expect.any(Number),
          memory: {
            total: expect.any(Number),
            free: expect.any(Number),
            usage: expect.any(Number)
          },
          loadAvg: expect.any(Array),
          network: expect.any(Object)
        },
        process: {
          pid: expect.any(Number),
          ppid: expect.any(Number),
          platform: expect.any(String),
          arch: expect.any(String),
          version: expect.any(String),
          memory: {
            rss: expect.any(Number),
            heapTotal: expect.any(Number),
            heapUsed: expect.any(Number),
            external: expect.any(Number),
            arrayBuffers: expect.any(Number)
          },
          uptime: expect.any(Number),
          env: expect.any(String)
        }
      });
    });
  });
  
  describe('GET /workers', () => {
    it('should return worker thread manager status', async () => {
      const response = await request(app)
        .get('/api/health/workers')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toEqual({
        status: 'ok',
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        workerThreads: {
          initialized: true,
          workers: {
            total: 4,
            busy: 1,
            available: 3
          },
          queue: {
            current: 2,
            max: 10
          },
          tasks: {
            queued: 100,
            completed: 98,
            rejected: 0,
            avgProcessingTime: '50ms'
          }
        }
      });
      
      expect(workerThreadManager.getStats).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      // Setup worker manager to throw error
      workerThreadManager.getStats.mockImplementationOnce(() => {
        throw new Error('Worker manager error');
      });
      
      const response = await request(app)
        .get('/api/health/workers')
        .expect('Content-Type', /json/)
        .expect(500);
      
      expect(response.body).toEqual({
        status: 'error',
        service: 'staycrest-api',
        version: '1.0.0',
        timestamp: expect.any(String),
        error: 'Worker manager error'
      });
    });
  });
}); 