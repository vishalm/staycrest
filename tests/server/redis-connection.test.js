/**
 * Redis Connection Tests
 */
const redis = require('redis');
const { connectToRedis, createRedisCache } = require('../../server/database/redis-connection');

// Mock Redis
jest.mock('redis', () => {
  const eventEmitter = {
    on: jest.fn().mockReturnThis(),
    emit: jest.fn()
  };

  const client = {
    ...eventEmitter,
    connect: jest.fn().mockResolvedValue(true),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    isReady: true
  };

  return {
    createClient: jest.fn(() => client)
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

describe('Redis Connection', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.REDIS_URI;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;
    delete process.env.REDIS_TLS;
  });
  
  describe('connectToRedis', () => {
    it('should create Redis client with default options', () => {
      // Execute
      const client = connectToRedis();
      
      // Verify
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({
        url: 'redis://localhost:6379'
      }));
      expect(client.connect).toHaveBeenCalled();
    });
    
    it('should use custom Redis URI from environment', () => {
      // Setup
      process.env.REDIS_URI = 'redis://customhost:6380';
      
      // Execute
      const client = connectToRedis();
      
      // Verify
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({
        url: 'redis://customhost:6380'
      }));
    });
    
    it('should use Redis password from environment', () => {
      // Setup
      process.env.REDIS_PASSWORD = 'secretpassword';
      
      // Execute
      const client = connectToRedis();
      
      // Verify
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({
        password: 'secretpassword'
      }));
    });
    
    it('should use Redis database index from environment', () => {
      // Setup
      process.env.REDIS_DB = '2';
      
      // Execute
      const client = connectToRedis();
      
      // Verify
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({
        database: 2
      }));
    });
    
    it('should enable TLS when specified in environment', () => {
      // Setup
      process.env.REDIS_TLS = 'true';
      
      // Execute
      const client = connectToRedis();
      
      // Verify
      expect(redis.createClient).toHaveBeenCalledWith(expect.objectContaining({
        tls: {}
      }));
    });
    
    it('should register event handlers', () => {
      // Execute
      const client = connectToRedis();
      
      // Verify
      expect(client.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(client.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(client.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(client.on).toHaveBeenCalledWith('reconnecting', expect.any(Function));
      expect(client.on).toHaveBeenCalledWith('end', expect.any(Function));
    });
  });
  
  describe('createRedisCache', () => {
    it('should create a cache instance with default TTL', async () => {
      // Execute
      const cache = createRedisCache();
      
      // Verify it's an object with expected methods
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.del).toBe('function');
      expect(typeof cache.exists).toBe('function');
      expect(typeof cache.getClient).toBe('function');
      expect(typeof cache.close).toBe('function');
      
      // Verify redis client was created
      expect(redis.createClient).toHaveBeenCalled();
    });
    
    it('should get cached values with JSON parsing', async () => {
      // Setup
      const mockValue = JSON.stringify({ foo: 'bar' });
      redis.createClient().get.mockResolvedValue(mockValue);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.get('test-key');
      
      // Verify
      expect(redis.createClient().get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual({ foo: 'bar' });
    });
    
    it('should return null for non-existent keys', async () => {
      // Setup
      redis.createClient().get.mockResolvedValue(null);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.get('non-existent-key');
      
      // Verify
      expect(result).toBeNull();
    });
    
    it('should set values with JSON stringification and TTL', async () => {
      // Execute
      const cache = createRedisCache(60); // 1 minute TTL
      const value = { foo: 'bar', num: 123 };
      await cache.set('test-key', value);
      
      // Verify
      expect(redis.createClient().set).toHaveBeenCalledWith(
        'test-key', 
        JSON.stringify(value), 
        { EX: 60 }
      );
    });
    
    it('should set values with custom TTL', async () => {
      // Execute
      const cache = createRedisCache();
      const value = { test: true };
      await cache.set('test-key', value, 120); // 2 minutes TTL
      
      // Verify
      expect(redis.createClient().set).toHaveBeenCalledWith(
        'test-key', 
        JSON.stringify(value), 
        { EX: 120 }
      );
    });
    
    it('should delete keys', async () => {
      // Execute
      const cache = createRedisCache();
      await cache.del('test-key');
      
      // Verify
      expect(redis.createClient().del).toHaveBeenCalledWith('test-key');
    });
    
    it('should check if keys exist', async () => {
      // Setup
      redis.createClient().exists.mockResolvedValue(1);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.exists('test-key');
      
      // Verify
      expect(redis.createClient().exists).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });
    
    it('should return the underlying Redis client', () => {
      // Execute
      const cache = createRedisCache();
      const client = cache.getClient();
      
      // Verify
      expect(client).toBe(redis.createClient());
    });
    
    it('should close the Redis connection', async () => {
      // Execute
      const cache = createRedisCache();
      await cache.close();
      
      // Verify
      expect(redis.createClient().quit).toHaveBeenCalled();
    });
    
    it('should handle errors in get operation', async () => {
      // Setup
      const mockError = new Error('Redis error');
      redis.createClient().get.mockRejectedValue(mockError);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.get('test-key');
      
      // Verify
      expect(result).toBeNull();
    });
    
    it('should handle errors in set operation', async () => {
      // Setup
      const mockError = new Error('Redis error');
      redis.createClient().set.mockRejectedValue(mockError);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.set('test-key', { data: 'value' });
      
      // Verify
      expect(result).toBe(false);
    });
    
    it('should handle errors in del operation', async () => {
      // Setup
      const mockError = new Error('Redis error');
      redis.createClient().del.mockRejectedValue(mockError);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.del('test-key');
      
      // Verify
      expect(result).toBe(false);
    });
    
    it('should handle errors in exists operation', async () => {
      // Setup
      const mockError = new Error('Redis error');
      redis.createClient().exists.mockRejectedValue(mockError);
      
      // Execute
      const cache = createRedisCache();
      const result = await cache.exists('test-key');
      
      // Verify
      expect(result).toBe(false);
    });
  });
}); 