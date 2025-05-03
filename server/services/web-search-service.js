const axios = require('axios');
const winston = require('winston');
const LoyaltyWebsiteManager = require('./loyalty-website-manager');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/web-search.log' })
  ],
});

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
  }
  
  /**
   * Initialize the service
   */
  async initialize() {
    try {
      // Initialize loyalty website manager
      await this.loyaltyManager.initialize();
      
      // Test search APIs
      await this.validateSearchAPIs();
      
      this.isInitialized = true;
      logger.info('Web search service initialized');
    } catch (error) {
      logger.error(`Failed to initialize web search service: ${error.message}`);
      // Continue even if initialization fails
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
        await axios.get(
          `https://www.googleapis.com/customsearch/v1?key=${this.apiKeys.google}&cx=${this.customSearchEngineId}&q=test`
        );
        validationResults.google = true;
      } catch (error) {
        logger.warn(`Google Search API validation failed: ${error.message}`);
        validationResults.google = false;
      }
    }
    
    // Test other search APIs as needed
    
    return validationResults;
  }
  
  /**
   * Search the web
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    if (!this.isInitialized) {
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
        logger.debug(`Cache hit for query: ${query}`);
        return {
          ...cachedResult.data,
          fromCache: true
        };
      }
    }
    
    // Execute search based on selected source
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
        results = await this.searchGoogle(query, searchOptions);
    }
    
    // Cache results
    this.searchCache.set(cacheKey, {
      timestamp: Date.now(),
      data: results
    });
    
    return results;
  }
  
  /**
   * Search using Google Custom Search API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchGoogle(query, options) {
    try {
      if (!this.apiKeys.google || !this.customSearchEngineId) {
        throw new Error('Google Search API is not configured');
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
      
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', { params });
      
      return {
        source: 'google',
        results: this.parseGoogleResults(response.data),
        totalResults: response.data.searchInformation?.totalResults,
        searchTime: response.data.searchInformation?.searchTime,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Google search error: ${error.message}`);
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
    return {
      initialized: this.isInitialized,
      cacheSize: this.searchCache.size,
      supportedSources: this.getSupportedSources(),
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
}

module.exports = new WebSearchService(); 