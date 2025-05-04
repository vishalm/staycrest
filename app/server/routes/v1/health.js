const express = require('express');
const router = express.Router();
const os = require('os');
const prom = require('../../services/metrics-service');
const { protect, authorize } = require('../../services/auth-service');
const logger = require('../../services/logging-service').getLogger('health');

// Get services
const webSearchService = require('../../services/web-search-service');
const toolManager = require('../../mcp/tool-manager');
const loggingService = require('../../services/logging-service');

// Initialize metrics
const register = prom.register;

/**
 * @swagger
 * tags:
 *   name: Health
 *   description: System health and monitoring endpoints
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get system health status
 *     description: Returns basic information about system health
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 system:
 *                   type: object
 *                 services:
 *                   type: object
 *       503:
 *         description: One or more services are unhealthy
 *       500:
 *         description: Health check failed
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
 * @swagger
 * /health/status:
 *   get:
 *     summary: Get detailed system status
 *     description: Returns detailed information about all system components (admin only)
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed system status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized - authentication required
 *       403:
 *         description: Forbidden - insufficient permissions
 *       500:
 *         description: Status check failed
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
      apiVersion: req.apiVersion || '1',
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
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Get Prometheus-compatible metrics
 *     description: Returns metrics in Prometheus format
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Prometheus-compatible metrics
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       500:
 *         description: Metrics collection failed
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

module.exports = router; 