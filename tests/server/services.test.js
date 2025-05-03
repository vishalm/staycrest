/**
 * Server Services Tests
 */
const mockAxios = require('jest-mock-axios').default;
const LoyaltyWebsiteManager = require('../../server/services/loyalty-website-manager');
const WebSearchService = require('../../server/services/web-search-service');
const LLMProvider = require('../../server/services/llm-provider');
const AnalyticsService = require('../../server/services/analytics-service');

// Mock dependencies
jest.mock('axios');
jest.mock('winston', () => {
  return {
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
  };
});

describe('Server Services', () => {
  afterEach(() => {
    mockAxios.reset();
  });
  
  describe('LoyaltyWebsiteManager', () => {
    it('should initialize with default sources', async () => {
      // Mock axios successful response
      mockAxios.get.mockResolvedValueOnce({ status: 200 });
      
      // Call initialize
      const result = await LoyaltyWebsiteManager.initialize();
      
      // Verify result
      expect(result).toBe(true);
      expect(LoyaltyWebsiteManager.initialized).toBe(true);
      expect(LoyaltyWebsiteManager.sources.size).toBeGreaterThan(0);
    });
    
    it('should get enabled sources', () => {
      // Set up mock sources
      LoyaltyWebsiteManager.sources = new Map([
        ['source1', { id: 'source1', name: 'Source 1', enabled: true }],
        ['source2', { id: 'source2', name: 'Source 2', enabled: false }],
        ['source3', { id: 'source3', name: 'Source 3', enabled: true }]
      ]);
      
      // Get enabled sources
      const enabledSources = LoyaltyWebsiteManager.getEnabledSources();
      
      // Verify result
      expect(enabledSources).toHaveLength(2);
      expect(enabledSources[0].id).toBe('source1');
      expect(enabledSources[1].id).toBe('source3');
    });
    
    it('should add a new source', () => {
      // Add a new source
      const newSource = LoyaltyWebsiteManager.addSource({
        id: 'test-source',
        name: 'Test Source',
        url: 'https://test-source.com'
      });
      
      // Verify result
      expect(newSource).toBeDefined();
      expect(newSource.id).toBe('test-source');
      expect(newSource.status).toBe('unknown');
      expect(LoyaltyWebsiteManager.sources.has('test-source')).toBe(true);
    });
    
    it('should update an existing source', () => {
      // Set up mock source
      LoyaltyWebsiteManager.sources.set('update-source', {
        id: 'update-source',
        name: 'Update Source',
        url: 'https://update-source.com',
        enabled: true,
        metadata: {
          added: new Date(),
          lastUpdated: new Date()
        }
      });
      
      // Update the source
      const updatedSource = LoyaltyWebsiteManager.updateSource('update-source', {
        name: 'Updated Source Name',
        enabled: false
      });
      
      // Verify result
      expect(updatedSource).toBeDefined();
      expect(updatedSource.name).toBe('Updated Source Name');
      expect(updatedSource.enabled).toBe(false);
      expect(updatedSource.url).toBe('https://update-source.com');
    });
    
    it('should remove a source', () => {
      // Set up mock source
      LoyaltyWebsiteManager.sources.set('remove-source', {
        id: 'remove-source',
        name: 'Remove Source',
        url: 'https://remove-source.com'
      });
      
      // Remove the source
      const result = LoyaltyWebsiteManager.removeSource('remove-source');
      
      // Verify result
      expect(result).toBe(true);
      expect(LoyaltyWebsiteManager.sources.has('remove-source')).toBe(false);
    });
  });
  
  describe('WebSearchService', () => {
    beforeEach(() => {
      // Reset WebSearchService state
      WebSearchService.isInitialized = false;
      WebSearchService.searchCache = new Map();
    });
    
    it('should initialize the service', async () => {
      // Mock successful responses
      mockAxios.get.mockResolvedValueOnce({ status: 200 });
      
      // Call initialize
      await WebSearchService.initialize();
      
      // Verify result
      expect(WebSearchService.isInitialized).toBe(true);
    });
    
    it('should use cache for repeated searches', async () => {
      // Set up test query and options
      const query = 'test query';
      const options = { limit: 5 };
      
      // Add to cache
      WebSearchService.searchCache.set(
        WebSearchService.generateCacheKey(query, options),
        {
          timestamp: Date.now(),
          data: { results: ['result1', 'result2'] }
        }
      );
      
      // Perform search
      const result = await WebSearchService.search(query, options);
      
      // Verify result came from cache
      expect(result.fromCache).toBe(true);
      expect(result.results).toEqual(['result1', 'result2']);
      expect(mockAxios.get).not.toHaveBeenCalled();
    });
    
    it('should clear cache', () => {
      // Add some items to cache
      WebSearchService.searchCache.set('key1', { data: 'value1' });
      WebSearchService.searchCache.set('key2', { data: 'value2' });
      
      // Verify cache has items
      expect(WebSearchService.searchCache.size).toBe(2);
      
      // Clear cache
      WebSearchService.clearCache();
      
      // Verify cache is empty
      expect(WebSearchService.searchCache.size).toBe(0);
    });
    
    it('should parse hotel query correctly', () => {
      // Test query
      const query = 'Find hotels in New York from June 10 to June 15';
      
      // Parse query
      const params = WebSearchService.parseHotelQuery(query);
      
      // Verify parsing
      expect(params.location).toBe('New York');
      expect(params.checkIn).toBe('June 10');
      expect(params.checkOut).toBe('June 15');
    });
    
    it('should get service status', () => {
      // Set up test state
      WebSearchService.isInitialized = true;
      WebSearchService.searchCache.set('key1', { data: 'value1' });
      
      // Get status
      const status = WebSearchService.getStatus();
      
      // Verify status
      expect(status.initialized).toBe(true);
      expect(status.cacheSize).toBe(1);
      expect(status.supportedSources).toBeDefined();
    });
  });
  
  describe('LLMProvider', () => {
    beforeEach(() => {
      // Reset LLMProvider state
      LLMProvider.initialized = false;
      LLMProvider.clients = {};
    });
    
    it('should initialize with default provider', async () => {
      // Mock axios response for Ollama
      mockAxios.get.mockResolvedValueOnce({ status: 200, data: { models: [] } });
      
      // Set provider to ollama
      LLMProvider.provider = 'ollama';
      
      // Initialize
      const result = await LLMProvider.initialize();
      
      // Verify result
      expect(LLMProvider.initialized).toBe(true);
      expect(LLMProvider.clients.ollama).toBeDefined();
    });
    
    it('should track metrics correctly', () => {
      // Initial metrics
      expect(LLMProvider.metrics.totalCalls).toBe(0);
      
      // Update metrics for a successful call
      LLMProvider.updateMetrics(100, 50, false);
      
      // Verify metrics
      expect(LLMProvider.metrics.totalCalls).toBe(1);
      expect(LLMProvider.metrics.totalTokens).toBe(50);
      expect(LLMProvider.metrics.errors).toBe(0);
      expect(LLMProvider.metrics.averageLatency).toBe(100);
      
      // Update metrics for an error
      LLMProvider.updateMetrics(200, 0, true);
      
      // Verify metrics
      expect(LLMProvider.metrics.totalCalls).toBe(2);
      expect(LLMProvider.metrics.errors).toBe(1);
      expect(LLMProvider.metrics.averageLatency).toBe(150); // (100 + 200) / 2 = 150
    });
    
    it('should reset metrics', () => {
      // Set up some metrics
      LLMProvider.metrics = {
        totalCalls: 10,
        totalTokens: 500,
        averageLatency: 120,
        errors: 2
      };
      
      // Reset metrics
      LLMProvider.resetMetrics();
      
      // Verify reset
      expect(LLMProvider.metrics.totalCalls).toBe(0);
      expect(LLMProvider.metrics.totalTokens).toBe(0);
      expect(LLMProvider.metrics.averageLatency).toBe(0);
      expect(LLMProvider.metrics.errors).toBe(0);
    });
  });
  
  describe('AnalyticsService', () => {
    // Test event metrics tracking
    it('should record internal event', () => {
      // Set up test data
      const eventName = 'test_event';
      const properties = { test: 'property' };
      const userId = 'test_user';
      
      // Call method
      AnalyticsService.recordInternalEvent(eventName, properties, userId);
      
      // Verify result
      expect(AnalyticsService.metrics.userSessions.has(userId)).toBe(true);
      const session = AnalyticsService.metrics.userSessions.get(userId);
      expect(session.eventCount).toBe(1);
      expect(session.events[0].name).toBe(eventName);
    });
    
    it('should track API calls', () => {
      // Set up test data
      const endpoint = 'test_endpoint';
      const responseTime = 100;
      
      // Track API call
      AnalyticsService.trackApiCall(endpoint, responseTime, false);
      
      // Verify result
      expect(AnalyticsService.metrics.apiCalls[endpoint]).toBeDefined();
      expect(AnalyticsService.metrics.apiCalls[endpoint].count).toBe(1);
      expect(AnalyticsService.metrics.apiCalls[endpoint].totalResponseTime).toBe(responseTime);
      expect(AnalyticsService.metrics.apiCalls[endpoint].errors).toBe(0);
      
      // Track error API call
      AnalyticsService.trackApiCall(endpoint, 50, true);
      
      // Verify updated result
      expect(AnalyticsService.metrics.apiCalls[endpoint].count).toBe(2);
      expect(AnalyticsService.metrics.apiCalls[endpoint].totalResponseTime).toBe(150); // 100 + 50
      expect(AnalyticsService.metrics.apiCalls[endpoint].errors).toBe(1);
    });
    
    it('should track searches', () => {
      // Set up test data
      const query = 'test search';
      const filters = { location: 'New York' };
      const resultsCount = 10;
      const userId = 'test_user';
      
      // Track search
      AnalyticsService.trackSearch(query, filters, resultsCount, userId);
      
      // Verify result
      expect(AnalyticsService.metrics.searchQueries).toHaveLength(1);
      expect(AnalyticsService.metrics.searchQueries[0].query).toBe(query);
      expect(AnalyticsService.metrics.searchQueries[0].resultsCount).toBe(resultsCount);
      expect(AnalyticsService.metrics.searchQueries[0].userId).toBe(userId);
    });
    
    it('should get analytics metrics', () => {
      // Set up test data
      AnalyticsService.metrics.userSessions = new Map();
      AnalyticsService.metrics.userSessions.set('user1', {
        lastSeen: new Date(),
        eventCount: 5
      });
      AnalyticsService.metrics.apiCalls = {
        'api1': { count: 10, errors: 1, totalResponseTime: 500 }
      };
      AnalyticsService.metrics.searchQueries = [
        { query: 'search1' },
        { query: 'search2' }
      ];
      
      // Get metrics
      const metrics = AnalyticsService.getMetrics();
      
      // Verify result
      expect(metrics.totalUsers).toBe(1);
      expect(metrics.apiCalls).toBeDefined();
      expect(metrics.apiResponseTimes).toBeDefined();
      expect(metrics.apiResponseTimes.api1).toBe(50); // 500/10
      expect(metrics.errorRate).toBeDefined();
    });
    
    it('should reset metrics', () => {
      // Set up test data
      AnalyticsService.metrics.userSessions = new Map();
      AnalyticsService.metrics.userSessions.set('user1', {
        lastSeen: new Date(),
        eventCount: 5
      });
      AnalyticsService.metrics.searchQueries = [
        { query: 'search1' },
        { query: 'search2' }
      ];
      
      // Reset metrics
      AnalyticsService.resetMetrics();
      
      // Verify result
      expect(AnalyticsService.metrics.userSessions.size).toBe(0);
      expect(AnalyticsService.metrics.searchQueries).toHaveLength(0);
    });
  });
}); 