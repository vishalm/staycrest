const express = require('express');
const router = express.Router();
const os = require('os');
const prom = require('../services/metrics-service');
const { protect, authorize } = require('../services/auth-service');
const logger = require('../services/logging-service').getLogger('health');

// Get services
const webSearchService = require('../services/web-search-service');
const toolManager = require('../mcp/tool-manager');
const loggingService = require('../services/logging-service');

// Initialize metrics
prom.collectDefaultMetrics();
const register = prom.register;

// Define custom metrics
const searchLatency = new prom.Histogram(
  'staycrest_search_latency_seconds',
  'Search request latency in seconds',
  ['source', 'type'],
  [0.1, 0.5, 1, 2, 5, 10]
);

const searchRequests = new prom.Counter(
  'staycrest_search_requests_total',
  'Total number of search requests',
  ['source', 'status']
);

const searchErrors = new prom.Counter(
  'staycrest_search_errors_total',
  'Total number of search errors',
  ['source', 'code']
);

const cacheHitRatio = new prom.Gauge(
  'staycrest_search_cache_hit_ratio',
  'Search cache hit ratio'
);

const toolUsage = new prom.Counter(
  'staycrest_tool_usage_total',
  'Total number of tool executions',
  ['tool', 'status']
);

const activeUsers = new prom.Gauge(
  'staycrest_active_users',
  'Number of active users'
);

/**
 * @desc    Get system health status
 * @route   GET /api/health
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Basic system info
    const systemInfo = {
      uptime: process.uptime(),
      memory: {
        free: os.freemem(),
        total: os.totalmem()
      },
      cpus: os.cpus().length,
      loadAvg: os.loadavg()
    };
    
    // Check search service health
    let searchStatus = { initialized: false };
    try {
      searchStatus = await webSearchService.healthCheck();
    } catch (error) {
      logger.error('Error getting search service health', { error: error.message });
    }
    
    // Collect statuses from other components
    const statuses = {
      system: {
        healthy: true,
        ...systemInfo
      },
      services: {
        search: searchStatus
      }
    };
    
    // Determine overall health
    const isHealthy = searchStatus.healthy;
    
    // Return appropriate status code based on health
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      ...statuses
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * @desc    Get detailed system status (admin only)
 * @route   GET /api/health/status
 * @access  Admin/SuperAdmin
 */
router.get('/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    // Get detailed status from all components
    const searchStatus = await webSearchService.healthCheck();
    const toolsStatus = toolManager.getMetrics();
    const loggersStatus = loggingService.getLoggers();
    
    // Get memory usage
    const memoryUsage = process.memoryUsage();
    
    // Return detailed status
    res.status(200).json({
      status: 'success',
      timestamp: new Date(),
      search: searchStatus,
      tools: toolsStatus,
      logging: loggersStatus,
      system: {
        uptime: process.uptime(),
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          free: os.freemem(),
          total: os.totalmem()
        },
        cpus: os.cpus().length,
        loadAvg: os.loadavg(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        env: process.env.NODE_ENV
      }
    });
  } catch (error) {
    logger.error('Status check failed', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Status check failed',
      error: error.message
    });
  }
});

/**
 * @desc    Prometheus metrics endpoint
 * @route   GET /api/health/metrics
 * @access  Public
 */
router.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Metrics collection failed', { error: error.message });
    res.status(500).send('Error collecting metrics');
  }
});

// Export metrics for instrumentation
module.exports = {
  router,
  metrics: {
    searchLatency,
    searchRequests,
    searchErrors,
    cacheHitRatio,
    toolUsage,
    activeUsers
  }
}; 