/**
 * Health Check Routes
 * 
 * Provides endpoints for health checking and readiness/liveness probes for Kubernetes.
 */

const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const { version } = require('../../package.json');
const workerThreadManager = require('../services/worker-thread-manager');
const searchSourcesService = require('../services/search-sources-service');

const router = express.Router();

// Track service start time for uptime calculation
const startTime = Date.now();

// Simple health check for load balancers
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'staycrest-api',
    version,
    timestamp: new Date().toISOString()
  });
});

// Liveness probe for Kubernetes - checks if the service is running
router.get('/liveness', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: 'staycrest-api',
    version,
    timestamp: new Date().toISOString()
  });
});

// Readiness probe for Kubernetes - checks if the service is ready to receive traffic
router.get('/readiness', async (req, res) => {
  // Check database connection
  const isMongoConnected = mongoose.connection.readyState === 1; // 1 = connected
  
  // Check Redis connection (you might need to adapt this based on your Redis connection)
  let isRedisConnected = false;
  try {
    const redisClient = req.app.get('redisClient');
    isRedisConnected = redisClient && redisClient.isReady;
  } catch (error) {
    console.error('Error checking Redis connection:', error);
  }
  
  // Check worker thread manager
  let isWorkerManagerReady = false;
  try {
    const workerStats = workerThreadManager.getStats();
    isWorkerManagerReady = workerStats.initialized;
  } catch (error) {
    console.error('Error checking worker thread manager:', error);
  }
  
  // Check search sources service
  let isSearchSourcesReady = false;
  try {
    const searchSourcesStatus = searchSourcesService.getStatus();
    isSearchSourcesReady = searchSourcesStatus.initialized;
  } catch (error) {
    console.error('Error checking search sources service:', error);
  }
  
  // Overall readiness status
  const isReady = isMongoConnected && isRedisConnected && isWorkerManagerReady && isSearchSourcesReady;
  
  const status = {
    status: isReady ? 'ok' : 'not_ready',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: 'staycrest-api',
    version,
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: isMongoConnected ? 'connected' : 'disconnected',
      redis: isRedisConnected ? 'connected' : 'disconnected',
      workerThreads: isWorkerManagerReady ? 'ready' : 'not_ready',
      searchSources: isSearchSourcesReady ? 'ready' : 'not_ready'
    }
  };
  
  res.status(isReady ? 200 : 503).json(status);
});

// Startup probe for Kubernetes - checks if the service has completed initialization
router.get('/startup', async (req, res) => {
  // Check if all required services are initialized
  let isStartupComplete = false;
  
  try {
    // Check if database connection is established
    const isMongoConnected = mongoose.connection.readyState === 1;
    
    // Check if worker thread manager is initialized
    const workerStats = workerThreadManager.getStats();
    const isWorkerManagerReady = workerStats.initialized;
    
    // Check if Redis is connected
    const redisClient = req.app.get('redisClient');
    const isRedisConnected = redisClient && redisClient.isReady;
    
    // Check search sources service
    const searchSourcesStatus = searchSourcesService.getStatus();
    const isSearchSourcesReady = searchSourcesStatus.initialized;
    
    // Overall startup status
    isStartupComplete = isMongoConnected && isWorkerManagerReady && isRedisConnected && isSearchSourcesReady;
    
    res.status(isStartupComplete ? 200 : 503).json({
      status: isStartupComplete ? 'ok' : 'initializing',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      service: 'staycrest-api',
      version,
      timestamp: new Date().toISOString(),
      dependencies: {
        mongodb: isMongoConnected ? 'connected' : 'disconnected',
        redis: isRedisConnected ? 'connected' : 'disconnected',
        workerThreads: isWorkerManagerReady ? 'ready' : 'not_ready',
        searchSources: isSearchSourcesReady ? 'ready' : 'not_ready'
      }
    });
  } catch (error) {
    console.error('Error checking startup status:', error);
    res.status(500).json({
      status: 'error',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      service: 'staycrest-api',
      version,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Detailed system information for internal monitoring
router.get('/system', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const systemInfo = {
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: 'staycrest-api',
    version,
    timestamp: new Date().toISOString(),
    system: {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: Math.round((1 - os.freemem() / os.totalmem()) * 100)
      },
      loadAvg: os.loadavg(),
      network: Object.entries(os.networkInterfaces())
        .reduce((acc, [name, interfaces]) => {
          acc[name] = interfaces.map(iface => ({
            address: iface.address,
            family: iface.family,
            internal: iface.internal
          }));
          return acc;
        }, {})
    },
    process: {
      pid: process.pid,
      ppid: process.ppid,
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers
      },
      uptime: process.uptime(),
      env: process.env.NODE_ENV || 'development'
    }
  };
  
  res.status(200).json(systemInfo);
});

// Detailed worker thread information
router.get('/workers', (req, res) => {
  try {
    const workerStats = workerThreadManager.getStats();
    
    res.status(200).json({
      status: 'ok',
      service: 'staycrest-api',
      version,
      timestamp: new Date().toISOString(),
      workerThreads: workerStats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'staycrest-api',
      version,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Search sources service status
router.get('/search-sources', (req, res) => {
  try {
    const searchSourcesStatus = searchSourcesService.getStatus();
    
    res.status(200).json({
      status: 'ok',
      service: 'staycrest-api',
      version,
      timestamp: new Date().toISOString(),
      searchSources: {
        initialized: searchSourcesStatus.initialized,
        loyaltyProgramsCount: searchSourcesStatus.loyaltyProgramsCount,
        webSearchProvidersCount: searchSourcesStatus.webSearchProvidersCount,
        aggregatorsCount: searchSourcesStatus.aggregatorsCount,
        directBookingPlatformsCount: searchSourcesStatus.directBookingPlatformsCount,
        enabledProvidersCount: searchSourcesStatus.enabledProvidersCount
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'staycrest-api',
      version,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Export router and constants
module.exports = {
  router,
  startTime
}; 