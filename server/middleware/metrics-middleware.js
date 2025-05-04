/**
 * Metrics Middleware
 * 
 * Collects application metrics for monitoring and observability.
 * Records response times, resource usage, and custom business metrics.
 */

const winston = require('winston');
const os = require('os');
const promClient = require('prom-client');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'metrics-middleware' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/metrics.log' })
  ],
});

// Create custom metrics
// Memory usage gauge
const memoryGauge = new promClient.Gauge({
  name: 'nodejs_memory_usage_bytes',
  help: 'Memory usage of the Node.js process in bytes',
  labelNames: ['type']
});

// CPU usage gauge
const cpuGauge = new promClient.Gauge({
  name: 'nodejs_cpu_usage_percentage',
  help: 'CPU usage of the Node.js process as a percentage',
  labelNames: ['core']
});

// Event loop lag gauge
const eventLoopLagGauge = new promClient.Gauge({
  name: 'nodejs_eventloop_lag_seconds',
  help: 'Event loop lag in seconds'
});

// Active connections gauge
const activeConnectionsGauge = new promClient.Gauge({
  name: 'nodejs_active_connections',
  help: 'Number of active connections'
});

// HTTP request counter by route
const routeCounter = new promClient.Counter({
  name: 'http_requests_by_route_total',
  help: 'Total number of HTTP requests by route',
  labelNames: ['method', 'route', 'status']
});

// API version counter
const apiVersionCounter = new promClient.Counter({
  name: 'api_version_requests_total',
  help: 'Total number of requests by API version',
  labelNames: ['version']
});

// Business metrics counters
const hotelSearchCounter = new promClient.Counter({
  name: 'hotel_searches_total',
  help: 'Total number of hotel searches',
  labelNames: ['filters_used']
});

const userLoginCounter = new promClient.Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['success', 'provider']
});

// Register all metrics
promClient.register.registerMetric(memoryGauge);
promClient.register.registerMetric(cpuGauge);
promClient.register.registerMetric(eventLoopLagGauge);
promClient.register.registerMetric(activeConnectionsGauge);
promClient.register.registerMetric(routeCounter);
promClient.register.registerMetric(apiVersionCounter);
promClient.register.registerMetric(hotelSearchCounter);
promClient.register.registerMetric(userLoginCounter);

// Collect system metrics every 15 seconds
const collectSystemMetrics = () => {
  try {
    // Memory metrics
    const memoryUsage = process.memoryUsage();
    memoryGauge.set({ type: 'rss' }, memoryUsage.rss);
    memoryGauge.set({ type: 'heapTotal' }, memoryUsage.heapTotal);
    memoryGauge.set({ type: 'heapUsed' }, memoryUsage.heapUsed);
    memoryGauge.set({ type: 'external' }, memoryUsage.external);
    
    // CPU metrics
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (let i = 0; i < cpus.length; i++) {
      const cpu = cpus[i];
      const total = Object.values(cpu.times).reduce((acc, tv) => acc + tv, 0);
      const idle = cpu.times.idle;
      
      totalIdle += idle;
      totalTick += total;
      
      // Calculate CPU usage percentage
      const usagePercent = 100 - (idle / total * 100);
      cpuGauge.set({ core: `core${i}` }, usagePercent);
    }
    
    // Event loop lag
    const start = process.hrtime();
    setImmediate(() => {
      const elapsed = process.hrtime(start);
      const lag = elapsed[0] + elapsed[1] / 1e9; // Convert to seconds
      eventLoopLagGauge.set(lag);
    });
    
    // Active connections (example, would need to be hooked into your HTTP server)
    if (global.serverConnections) {
      activeConnectionsGauge.set(global.serverConnections);
    }
  } catch (error) {
    logger.error(`Error collecting system metrics: ${error.message}`, { error });
  }
};

// Start collecting metrics
setInterval(collectSystemMetrics, 15000);

/**
 * Middleware function to collect route metrics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const metricsMiddleware = (req, res, next) => {
  // Record API version metrics
  if (req.apiVersion) {
    apiVersionCounter.inc({ version: req.apiVersion });
  }
  
  // Record route metrics on request completion
  res.on('finish', () => {
    // Normalize route path for metrics
    let route = 'unknown';
    
    if (req.route) {
      // Use route path if available
      route = req.baseUrl + req.route.path;
    } else {
      // Fallback to original URL but remove query params
      route = req.originalUrl.split('?')[0];
    }
    
    // Count request by route
    routeCounter.inc({
      method: req.method,
      route,
      status: res.statusCode
    });
    
    // Track business metrics
    
    // Hotel search metrics
    if (route.includes('/api/v1/hotels/search') || route.includes('/api/hotels/search')) {
      const hasFilters = req.query.filters || req.body.filters;
      hotelSearchCounter.inc({ filters_used: !!hasFilters ? 'yes' : 'no' });
    }
    
    // User login metrics
    if ((route.includes('/api/v1/auth/login') || route.includes('/api/auth/login')) && req.method === 'POST') {
      const success = res.statusCode === 200;
      const provider = req.body.provider || 'email';
      userLoginCounter.inc({ success: success ? 'true' : 'false', provider });
    }
  });
  
  next();
};

/**
 * Get the Prometheus registry
 * @returns {Object} Prometheus registry
 */
const getMetricsRegistry = () => {
  return promClient.register;
};

/**
 * Record a custom business metric
 * @param {string} metricName - Name of the metric
 * @param {Object} labels - Labels for the metric
 * @param {number} value - Value to increment or set
 */
const recordBusinessMetric = (metricName, labels = {}, value = 1) => {
  try {
    switch (metricName) {
      case 'hotel_search':
        hotelSearchCounter.inc({ filters_used: labels.filters_used || 'no' }, value);
        break;
      case 'user_login':
        userLoginCounter.inc({ 
          success: labels.success ? 'true' : 'false', 
          provider: labels.provider || 'email' 
        }, value);
        break;
      // Add more custom metrics here
      default:
        logger.warn(`Unknown metric name: ${metricName}`);
    }
  } catch (error) {
    logger.error(`Error recording business metric: ${error.message}`, { error, metricName, labels });
  }
};

module.exports = { 
  metricsMiddleware, 
  getMetricsRegistry,
  recordBusinessMetric
}; 