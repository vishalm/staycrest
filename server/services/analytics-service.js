const winston = require('winston');
const axios = require('axios');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics.log' })
  ],
});

/**
 * Analytics Service - Tracks user interactions and system metrics
 */
class AnalyticsService {
  constructor() {
    this.trackingEnabled = process.env.ENABLE_ANALYTICS === 'true';
    this.analyticsProvider = process.env.ANALYTICS_PROVIDER || 'internal';
    this.mixpanelToken = process.env.MIXPANEL_TOKEN;
    this.googleAnalyticsId = process.env.GA_TRACKING_ID;
    this.serverStartTime = Date.now();
    
    // In-memory storage for internal analytics
    this.metrics = {
      userSessions: new Map(),
      apiCalls: {},
      errors: [],
      searchQueries: [],
      conversationStats: {
        totalConversations: 0,
        averageLength: 0,
        totalMessages: 0
      },
      performanceMetrics: {
        averageResponseTime: {},
        peakUsage: {
          cpu: 0,
          memory: 0
        }
      }
    };
    
    // Performance tracking
    this.lastMetricsUpdate = Date.now();
    this.metricsUpdateInterval = 60000; // 1 minute
  }
  
  /**
   * Initialize the analytics service
   */
  async initialize() {
    try {
      if (!this.trackingEnabled) {
        logger.info('Analytics tracking is disabled');
        return;
      }
      
      // Initialize external analytics providers if configured
      switch (this.analyticsProvider) {
        case 'mixpanel':
          await this.initializeMixpanel();
          break;
        case 'google':
          await this.initializeGoogleAnalytics();
          break;
        case 'internal':
        default:
          // Internal analytics is always available
          logger.info('Using internal analytics tracking');
      }
      
      // Start periodic metrics collection
      this.startPeriodicMetricsCollection();
      
      logger.info(`Analytics service initialized (provider: ${this.analyticsProvider})`);
    } catch (error) {
      logger.error(`Failed to initialize analytics service: ${error.message}`);
      // Continue with internal analytics if external fails
    }
  }
  
  /**
   * Initialize Mixpanel
   */
  async initializeMixpanel() {
    if (!this.mixpanelToken) {
      throw new Error('Mixpanel token not configured');
    }
    
    // Test connection to Mixpanel
    try {
      await axios.post(
        'https://api.mixpanel.com/track',
        {
          event: 'system_start',
          properties: {
            token: this.mixpanelToken,
            time: Math.floor(Date.now() / 1000),
            distinct_id: 'system'
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/plain'
          }
        }
      );
      
      logger.info('Mixpanel initialized successfully');
    } catch (error) {
      logger.error(`Mixpanel initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Initialize Google Analytics
   */
  async initializeGoogleAnalytics() {
    if (!this.googleAnalyticsId) {
      throw new Error('Google Analytics ID not configured');
    }
    
    // Implementation would depend on the GA4 library used
    logger.info('Google Analytics initialized successfully');
  }
  
  /**
   * Track user event
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Event properties
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async trackEvent(eventName, properties = {}, userId = null) {
    try {
      if (!this.trackingEnabled) {
        return false;
      }
      
      // Always record in internal metrics
      this.recordInternalEvent(eventName, properties, userId);
      
      // Track in external provider if configured
      if (this.analyticsProvider === 'mixpanel' && this.mixpanelToken) {
        await this.trackMixpanelEvent(eventName, properties, userId);
      } else if (this.analyticsProvider === 'google' && this.googleAnalyticsId) {
        await this.trackGoogleAnalyticsEvent(eventName, properties, userId);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error tracking event ${eventName}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Record event in internal metrics
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Event properties
   * @param {string} userId - User ID
   */
  recordInternalEvent(eventName, properties, userId) {
    const timestamp = new Date();
    
    // Track user session
    if (userId) {
      if (!this.metrics.userSessions.has(userId)) {
        this.metrics.userSessions.set(userId, {
          firstSeen: timestamp,
          lastSeen: timestamp,
          eventCount: 0,
          events: []
        });
      }
      
      const session = this.metrics.userSessions.get(userId);
      session.lastSeen = timestamp;
      session.eventCount++;
      
      // Keep latest 20 events per user
      if (session.events.length >= 20) {
        session.events.shift();
      }
      
      session.events.push({
        name: eventName,
        timestamp,
        properties
      });
    }
    
    // Track API calls
    if (eventName.startsWith('api_')) {
      const endpoint = properties.endpoint || 'unknown';
      if (!this.metrics.apiCalls[endpoint]) {
        this.metrics.apiCalls[endpoint] = {
          count: 0,
          errors: 0,
          totalResponseTime: 0,
          lastUsed: null
        };
      }
      
      const apiMetric = this.metrics.apiCalls[endpoint];
      apiMetric.count++;
      apiMetric.lastUsed = timestamp;
      
      if (properties.responseTime) {
        apiMetric.totalResponseTime += properties.responseTime;
      }
      
      if (properties.error) {
        apiMetric.errors++;
      }
    }
    
    // Track searches
    if (eventName === 'search_query') {
      // Keep latest 100 searches
      if (this.metrics.searchQueries.length >= 100) {
        this.metrics.searchQueries.shift();
      }
      
      this.metrics.searchQueries.push({
        query: properties.query,
        filters: properties.filters,
        userId,
        timestamp,
        resultsCount: properties.resultsCount
      });
    }
    
    // Track conversations
    if (eventName === 'conversation_start') {
      this.metrics.conversationStats.totalConversations++;
    } else if (eventName === 'conversation_message') {
      this.metrics.conversationStats.totalMessages++;
      this.metrics.conversationStats.averageLength = 
        this.metrics.conversationStats.totalMessages / this.metrics.conversationStats.totalConversations;
    }
    
    // Track errors
    if (eventName === 'error') {
      // Keep latest 100 errors
      if (this.metrics.errors.length >= 100) {
        this.metrics.errors.shift();
      }
      
      this.metrics.errors.push({
        message: properties.message,
        stack: properties.stack,
        userId,
        timestamp,
        context: properties.context
      });
    }
  }
  
  /**
   * Track event in Mixpanel
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Event properties
   * @param {string} userId - User ID
   */
  async trackMixpanelEvent(eventName, properties, userId) {
    try {
      await axios.post(
        'https://api.mixpanel.com/track',
        {
          event: eventName,
          properties: {
            ...properties,
            token: this.mixpanelToken,
            time: Math.floor(Date.now() / 1000),
            distinct_id: userId || 'anonymous'
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/plain'
          }
        }
      );
    } catch (error) {
      logger.error(`Error tracking Mixpanel event: ${error.message}`);
      // Don't throw, just log
    }
  }
  
  /**
   * Track event in Google Analytics
   * @param {string} eventName - Name of the event
   * @param {Object} properties - Event properties
   * @param {string} userId - User ID
   */
  async trackGoogleAnalyticsEvent(eventName, properties, userId) {
    // Implementation would depend on the GA4 library used
    logger.debug(`[GA] Tracked event ${eventName} for user ${userId || 'anonymous'}`);
  }
  
  /**
   * Start periodic collection of system metrics
   */
  startPeriodicMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.metricsUpdateInterval);
  }
  
  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      // Update peak usage
      if (memoryUsedMB > this.metrics.performanceMetrics.peakUsage.memory) {
        this.metrics.performanceMetrics.peakUsage.memory = memoryUsedMB;
      }
      
      // Track uptime
      const uptime = Math.floor((Date.now() - this.serverStartTime) / 1000);
      
      // Record system metrics
      this.recordInternalEvent('system_metrics', {
        memoryUsage: memoryUsedMB,
        uptime,
        timestamp: new Date()
      });
      
      this.lastMetricsUpdate = Date.now();
    } catch (error) {
      logger.error(`Error collecting system metrics: ${error.message}`);
    }
  }
  
  /**
   * Track API response time
   * @param {string} endpoint - API endpoint
   * @param {number} responseTime - Response time in ms
   * @param {boolean} isError - Whether this was an error response
   */
  trackApiCall(endpoint, responseTime, isError = false) {
    this.trackEvent('api_call', {
      endpoint,
      responseTime,
      error: isError
    });
  }
  
  /**
   * Track search query
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @param {number} resultsCount - Number of results
   * @param {string} userId - User ID
   */
  trackSearch(query, filters = {}, resultsCount = 0, userId = null) {
    this.trackEvent('search_query', {
      query,
      filters,
      resultsCount
    }, userId);
  }
  
  /**
   * Track error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @param {string} userId - User ID
   */
  trackError(error, context = {}, userId = null) {
    this.trackEvent('error', {
      message: error.message,
      stack: error.stack,
      context
    }, userId);
  }
  
  /**
   * Get analytics metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    // Calculate derived metrics
    const activeUsers = Array.from(this.metrics.userSessions.values())
      .filter(session => (Date.now() - session.lastSeen) < 1800000) // Active in last 30 minutes
      .length;
    
    // Average API response time
    const apiResponseTimes = {};
    Object.entries(this.metrics.apiCalls).forEach(([endpoint, metrics]) => {
      if (metrics.count > 0) {
        apiResponseTimes[endpoint] = metrics.totalResponseTime / metrics.count;
      }
    });
    
    return {
      activeUsers,
      totalUsers: this.metrics.userSessions.size,
      apiCalls: this.metrics.apiCalls,
      apiResponseTimes,
      topSearches: this.getTopSearches(10),
      conversationStats: this.metrics.conversationStats,
      errorRate: this.calculateErrorRate(),
      systemMetrics: {
        uptime: Math.floor((Date.now() - this.serverStartTime) / 1000),
        peakMemoryUsage: this.metrics.performanceMetrics.peakUsage.memory
      }
    };
  }
  
  /**
   * Get top searches
   * @param {number} limit - Number of top searches to return
   * @returns {Array} Top searches
   */
  getTopSearches(limit = 10) {
    const searchCounts = {};
    
    this.metrics.searchQueries.forEach(search => {
      const query = search.query.toLowerCase();
      searchCounts[query] = (searchCounts[query] || 0) + 1;
    });
    
    return Object.entries(searchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }
  
  /**
   * Calculate error rate
   * @returns {number} Error rate (percentage)
   */
  calculateErrorRate() {
    let totalCalls = 0;
    let totalErrors = 0;
    
    Object.values(this.metrics.apiCalls).forEach(metrics => {
      totalCalls += metrics.count;
      totalErrors += metrics.errors;
    });
    
    return totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0;
  }
  
  /**
   * Reset analytics metrics
   */
  resetMetrics() {
    this.metrics = {
      userSessions: new Map(),
      apiCalls: {},
      errors: [],
      searchQueries: [],
      conversationStats: {
        totalConversations: 0,
        averageLength: 0,
        totalMessages: 0
      },
      performanceMetrics: {
        averageResponseTime: {},
        peakUsage: {
          cpu: 0,
          memory: 0
        }
      }
    };
    
    logger.info('Analytics metrics reset');
  }
}

module.exports = new AnalyticsService(); 