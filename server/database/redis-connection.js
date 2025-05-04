/**
 * Redis Connection Manager
 * 
 * Handles Redis connection with connection pooling, resilience,
 * and automatic reconnection for improved reliability.
 */

const redis = require('redis');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'redis-connection' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/redis.log' })
  ],
});

// Connection options
const getRedisConfig = () => {
  const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';
  
  return {
    url: redisUri,
    socket: {
      reconnectStrategy: (retries) => {
        // Exponential backoff with max delay of 10 seconds
        const delay = Math.min(Math.pow(2, retries) * 100, 10000);
        logger.info(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
      connectTimeout: 10000, // 10 seconds
      keepAlive: 5000, // 5 seconds
    },
    password: process.env.REDIS_PASSWORD || undefined,
    database: parseInt(process.env.REDIS_DB || '0'),
    // Enable connection pooling
    commandsQueueMaxLength: 1000,
    // Enable better error handling
    disableOfflineQueue: false,
    enableAutoPipelining: true,
    // Enable TLS if needed
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
  };
};

// Create a Redis client with connection pooling and resilience
const connectToRedis = () => {
  const redisConfig = getRedisConfig();
  const client = redis.createClient(redisConfig);
  
  // Set up event listeners
  client.on('connect', () => {
    logger.info('Connected to Redis');
  });
  
  client.on('ready', () => {
    logger.info('Redis client ready');
  });
  
  client.on('error', (err) => {
    logger.error(`Redis client error: ${err.message}`, { error: err });
  });
  
  client.on('reconnecting', () => {
    logger.warn('Reconnecting to Redis');
  });
  
  client.on('end', () => {
    logger.info('Redis connection closed');
  });
  
  // Connect to Redis
  client.connect()
    .then(() => {
      logger.info('Redis connection established');
    })
    .catch((err) => {
      logger.error(`Failed to connect to Redis: ${err.message}`, { error: err });
    });
  
  return client;
};

/**
 * Create a Redis instance for use as a cache with TTL
 * @param {number} defaultTtl - Default TTL in seconds
 * @returns {Object} Redis client
 */
const createRedisCache = (defaultTtl = 3600) => {
  const client = connectToRedis();
  
  return {
    /**
     * Get a value from the cache
     * @param {string} key - Cache key
     * @returns {Promise<any>} Cached value or null
     */
    async get(key) {
      try {
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        logger.error(`Redis cache get error: ${error.message}`, { error, key });
        return null;
      }
    },
    
    /**
     * Set a value in the cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - TTL in seconds (optional)
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value, ttl = defaultTtl) {
      try {
        await client.set(key, JSON.stringify(value), { EX: ttl });
        return true;
      } catch (error) {
        logger.error(`Redis cache set error: ${error.message}`, { error, key });
        return false;
      }
    },
    
    /**
     * Delete a value from the cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} Success status
     */
    async del(key) {
      try {
        await client.del(key);
        return true;
      } catch (error) {
        logger.error(`Redis cache del error: ${error.message}`, { error, key });
        return false;
      }
    },
    
    /**
     * Check if a key exists in the cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} True if the key exists
     */
    async exists(key) {
      try {
        return await client.exists(key) === 1;
      } catch (error) {
        logger.error(`Redis cache exists error: ${error.message}`, { error, key });
        return false;
      }
    },
    
    /**
     * Get the underlying Redis client
     * @returns {Object} Redis client
     */
    getClient() {
      return client;
    },
    
    /**
     * Close the Redis connection
     * @returns {Promise<void>}
     */
    async close() {
      try {
        await client.quit();
        logger.info('Redis cache connection closed');
      } catch (error) {
        logger.error(`Redis cache close error: ${error.message}`, { error });
      }
    }
  };
};

module.exports = {
  connectToRedis,
  createRedisCache
}; 