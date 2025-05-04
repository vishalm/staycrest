const axios = require('axios');
const LoyaltyWebsiteManager = require('./loyalty-website-manager');
const logger = require('./logging-service').getLogger('web-search');

/**
 * Web Search Service - Handles external web searches and hotel aggregation
 */
class WebSearchService {
  constructor() {
    this.apiKeys = {
      google: process.env.GOOGLE_SEARCH_API_KEY,
      bing: process.env.BING_SEARCH_API_KEY,
      serp: process.env.SERPAPI_KEY,
      rapid: process.env.RAPID_API_KEY,
    };
    
    this.customSearchEngineId = process.env.GOOGLE_CSE_ID;
    this.loyaltyManager = new LoyaltyWebsiteManager();
    this.maxCacheAge = 3600000; // 1 hour
    this.searchCache = new Map();
    this.isInitialized = false;
    this.logger = logger.createChildLogger('web-search', { service: 'web-search' });
    
    // Log API keys status (not the actual keys)
    this.logger.debug('API keys configuration', {
      google: !!this.apiKeys.google,
      bing: !!this.apiKeys.bing,
      serp: !!this.apiKeys.serp,
      rapid: !!this.apiKeys.rapid,
      googleCSE: !!this.customSearchEngineId
    });
  }
  
  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.logger.info('Initializing web search service');
      
      // Initialize loyalty website manager
      await this.loyaltyManager.initialize();
      this.logger.debug('Loyalty manager initialized');
      
      // Test search APIs
      const validationResults = await this.validateSearchAPIs();
      this.logger.info('Search APIs validation completed', { validationResults });
      
      this.isInitialized = true;
      this.logger.info('Web search service initialized successfully');
      return true;
    } catch (error) {
      this.logger.logError(error, 'Failed to initialize web search service');
      // Continue even if initialization fails
      return false;
    }
  }
  
  /**
   * Validate search API keys
   */
  async validateSearchAPIs() {
    const validationResults = {};
    
    // Test Google Custom Search API if configured
    if (this.apiKeys.google && this.customSearchEngineId) {
      try {
        this.logger.debug('Testing Google Search API');
        await axios.get(
          `https://www.googleapis.com/customsearch/v1?key=${this.apiKeys.google}&cx=${this.customSearchEngineId}&q=test`
        );
        validationResults.google = true;
        this.logger.debug('Google Search API validation successful');
      } catch (error) {
        this.logger.logError(error, 'Google Search API validation failed');
        validationResults.google = false;
      }
    } else {
      this.logger.warn('Google Search API not configured', {
        hasApiKey: !!this.apiKeys.google,
        hasCSEId: !!this.customSearchEngineId
      });
      validationResults.google = false;
    }
    
    // Test Bing Search API if configured
    if (this.apiKeys.bing) {
      try {
        this.logger.debug('Testing Bing Search API');
        await axios.get('https://api.bing.microsoft.com/v7.0/search', {
          params: { q: 'test', count: 1 },
          headers: { 'Ocp-Apim-Subscription-Key': this.apiKeys.bing }
        });
        validationResults.bing = true;
        this.logger.debug('Bing Search API validation successful');
      } catch (error) {
        this.logger.logError(error, 'Bing Search API validation failed');
        validationResults.bing = false;
      }
    } else {
      this.logger.warn('Bing Search API not configured');
      validationResults.bing = false;
    }
    
    return validationResults;
  }
  
  /**
   * Search the web
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    const startTime = Date.now();
    
    try {
      this.logger.info('Performing search', { query, options });
      
      if (!this.isInitialized) {
        this.logger.warn('Service not initialized, attempting to initialize');
        await this.initialize();
      }
      
      const searchOptions = {
        limit: options.limit || 10,
        type: options.type || 'web',
        freshness: options.freshness || null,
        source: options.source || 'google',
        filter: options.filter || null,
        ...options
      };
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(query, searchOptions);
      
      // Check cache
      if (this.searchCache.has(cacheKey)) {
        const cachedResult = this.searchCache.get(cacheKey);
        if (Date.now() - cachedResult.timestamp < this.maxCacheAge) {
          this.logger.debug('Cache hit for query', { query });
          
          // Log metrics for cached response
          this.logger.logEvent('info', 'Search cache hit', {
            query,
            source: searchOptions.source,
            cacheAge: Date.now() - cachedResult.timestamp
          }, {
            responseTime: Date.now() - startTime,
            cacheHit: true
          });
          
          return {
            ...cachedResult.data,
            fromCache: true
          };
        }
      }
      
      // Execute search based on selected source
      this.logger.debug('Cache miss, executing search', { 
        source: searchOptions.source 
      });
      
      let results;
      switch (searchOptions.source) {
        case 'google':
          results = await this.searchGoogle(query, searchOptions);
          break;
        case 'bing':
          results = await this.searchBing(query, searchOptions);
          break;
        case 'hotels':
          results = await this.searchHotels(query, searchOptions);
          break;
        default:
          this.logger.warn('Unknown search source, falling back to Google', {
            requestedSource: searchOptions.source
          });
          results = await this.searchGoogle(query, searchOptions);
      }
      
      // Cache results
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: results
      });
      
      const duration = Date.now() - startTime;
      
      // Log search metrics
      this.logger.logEvent('info', 'Search completed', {
        query,
        source: searchOptions.source,
        resultCount: results.results?.length || 0
      }, {
        responseTime: duration,
        cacheHit: false
      });
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.logError(error, 'Error in search', {
        query,
        options,
        duration
      });
      
      throw error;
    }
  }
  
  /**
   * Search using Google Custom Search API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchGoogle(query, options) {
    const startTime = Date.now();
    
    try {
      this.logger.debug('Executing Google search', { query });
      
      if (!this.apiKeys.google || !this.customSearchEngineId) {
        const error = new Error('Google Search API is not configured');
        this.logger.error('Google Search API configuration missing', {
          hasApiKey: !!this.apiKeys.google,
          hasCSEId: !!this.customSearchEngineId
        });
        throw error;
      }
      
      const params = {
        key: this.apiKeys.google,
        cx: this.customSearchEngineId,
        q: query,
        num: options.limit
      };
      
      // Add optional parameters
      if (options.freshness) {
        params.dateRestrict = options.freshness;
      }
      
      this.logger.debug('Calling Google API', { params: {...params, key: '[REDACTED]'} });
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', { params });
      
      this.logger.debug('Google API response received', {
        status: response.status,
        itemCount: response.data.items?.length || 0
      });
      
      const parsedResults = this.parseGoogleResults(response.data);
      
      // Log metrics
      const duration = Date.now() - startTime;
      this.logger.logEvent('debug', 'Google search completed', {
        query,
        resultCount: parsedResults.length
      }, {
        responseTime: duration
      });
      
      return {
        source: 'google',
        results: parsedResults,
        totalResults: response.data.searchInformation?.totalResults,
        searchTime: response.data.searchInformation?.searchTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.logError(error, 'Google search error');
      throw error;
    }
  }
  
  /**
   * Parse Google search results
   * @param {Object} data - Raw Google API response
   * @returns {Array} Parsed results
   */
  parseGoogleResults(data) {
    if (!data.items) return [];
    
    return data.items.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet,
      displayLink: item.displayLink,
      source: 'google',
      type: 'web'
    }));
  }
  
  /**
   * Search using Bing Search API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchBing(query, options) {
    try {
      if (!this.apiKeys.bing) {
        throw new Error('Bing Search API is not configured');
      }
      
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        params: {
          q: query,
          count: options.limit,
          responseFilter: options.filter || 'webpages'
        },
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKeys.bing
        }
      });
      
      return {
        source: 'bing',
        results: this.parseBingResults(response.data),
        totalResults: response.data.webPages?.totalEstimatedMatches,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Bing search error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Parse Bing search results
   * @param {Object} data - Raw Bing API response
   * @returns {Array} Parsed results
   */
  parseBingResults(data) {
    if (!data.webPages || !data.webPages.value) return [];
    
    return data.webPages.value.map(item => ({
      title: item.name,
      link: item.url,
      snippet: item.snippet,
      displayLink: item.displayUrl,
      source: 'bing',
      type: 'web'
    }));
  }
  
  /**
   * Search for hotels across loyalty programs
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Hotel search results
   */
  async searchHotels(query, options) {
    try {
      const sources = this.loyaltyManager.getEnabledSources();
      
      if (sources.length === 0) {
        throw new Error('No hotel loyalty programs configured');
      }
      
      // Convert natural language query to search parameters
      const searchParams = this.parseHotelQuery(query);
      
      // Combine with explicit options
      const combinedParams = {
        ...searchParams,
        ...options.params
      };
      
      // For now, just search with first source
      // In production, would search multiple sources in parallel
      const source = sources[0];
      const results = await this.loyaltyManager.extractHotels(source.id, combinedParams);
      
      return {
        source: 'hotels',
        provider: source.name,
        results: results.data,
        timestamp: new Date(),
        query: query,
        parameters: combinedParams
      };
    } catch (error) {
      logger.error(`Hotel search error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Parse natural language hotel query into parameters
   * @param {string} query - Natural language query
   * @returns {Object} Structured search parameters
   */
  parseHotelQuery(query) {
    // In a real implementation, would use NLP or LLM to extract entities
    // For now, use basic parsing
    const params = {};
    
    // Extract location
    const locationMatch = query.match(/in\s+([a-zA-Z\s]+)/) || 
                       query.match(/at\s+([a-zA-Z\s]+)/);
    if (locationMatch) {
      params.location = locationMatch[1].trim();
    }
    
    // Extract dates
    const dateMatch = query.match(/from\s+(\w+\s+\d+)\s+to\s+(\w+\s+\d+)/);
    if (dateMatch) {
      params.checkIn = dateMatch[1];
      params.checkOut = dateMatch[2];
    }
    
    return params;
  }
  
  /**
   * Generate cache key
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {string} Cache key
   */
  generateCacheKey(query, options) {
    return `${query}_${JSON.stringify(options)}`;
  }
  
  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
    logger.info('Search cache cleared');
  }
  
  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    const supportedSources = this.getSupportedSources();
    
    return {
      initialized: this.isInitialized,
      cacheSize: this.searchCache.size,
      supportedSources,
      apis: {
        google: !!this.apiKeys.google && !!this.customSearchEngineId,
        bing: !!this.apiKeys.bing,
        serp: !!this.apiKeys.serp,
        rapid: !!this.apiKeys.rapid
      },
      loyaltyManager: this.loyaltyManager?.isInitialized || false,
      loyaltySources: this.loyaltyManager?.getEnabledSources().length || 0
    };
  }
  
  /**
   * Get supported search sources
   * @returns {Array} Supported sources
   */
  getSupportedSources() {
    const sources = ['web'];
    
    if (this.apiKeys.google && this.customSearchEngineId) {
      sources.push('google');
    }
    
    if (this.apiKeys.bing) {
      sources.push('bing');
    }
    
    if (this.loyaltyManager && this.loyaltyManager.getEnabledSources().length > 0) {
      sources.push('hotels');
    }
    
    return sources;
  }
  
  /**
   * Health check for the service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      const status = this.getStatus();
      
      // Test a simple search to validate functionality
      let searchWorking = false;
      let googleWorking = false;
      let bingWorking = false;
      let hotelSearchWorking = false;
      
      try {
        // Test Google search
        if (status.apis.google) {
          const googleResults = await this.searchGoogle('test', { limit: 1 });
          googleWorking = googleResults && googleResults.results && googleResults.results.length > 0;
        }
      } catch (error) {
        this.logger.error('Google search health check failed', { error: error.message });
      }
      
      try {
        // Test Bing search
        if (status.apis.bing) {
          const bingResults = await this.searchBing('test', { limit: 1 });
          bingWorking = bingResults && bingResults.results && bingResults.results.length > 0;
        }
      } catch (error) {
        this.logger.error('Bing search health check failed', { error: error.message });
      }
      
      try {
        // Test hotel search if loyalty manager is initialized
        if (this.loyaltyManager && this.loyaltyManager.isInitialized) {
          const hotelResults = await this.searchHotels('hotel in New York', {});
          hotelSearchWorking = hotelResults && hotelResults.results;
        }
      } catch (error) {
        this.logger.error('Hotel search health check failed', { error: error.message });
      }
      
      // Overall search functionality is working if any of the search methods is working
      searchWorking = googleWorking || bingWorking || hotelSearchWorking;
      
      return {
        ...status,
        healthy: this.isInitialized && searchWorking,
        searchWorking,
        searchEngines: {
          google: googleWorking,
          bing: bingWorking,
          hotels: hotelSearchWorking
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.logError(error, 'Error performing health check');
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

module.exports = new WebSearchService(); 