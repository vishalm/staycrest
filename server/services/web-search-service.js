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
    this.logger = logger;
    
    // Log API keys status (not the actual keys)
    this.logger.info('Web Search Service initialized', {
      providers: {
        google: !!this.apiKeys.google && !!this.customSearchEngineId,
        bing: !!this.apiKeys.bing,
        serp: !!this.apiKeys.serp,
        rapid: !!this.apiKeys.rapid
      }
    });
  }
  
  /**
   * Initialize the service
   */
  async initialize() {
    try {
      this.logger.info('Initializing Web Search Service');
      
      // Validate search APIs
      const validationResults = await this.validateSearchAPIs();
      
      this.logger.info('Search API validation results', {
        validationResults
      });
      
      // Initialize loyalty manager
      await this.loyaltyManager.initialize();
      
      this.isInitialized = true;
      this.logger.info('Web Search Service initialized successfully');
      
      return true;
    } catch (error) {
      this.logger.error('Failed to initialize Web Search Service', {
        error: error.message,
        stack: error.stack
      });
      throw error;
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
      this.logger.error(`Bing search error: ${error.message}`);
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
  async searchHotels(query, options = {}) {
    const startTime = Date.now();
    const searchId = `web-search-${Date.now()}`;

    try {
      this.logger.info('Starting hotel search', {
        searchId,
        query,
        options: JSON.stringify(options)
      });

      if (!this.isInitialized) {
        this.logger.warn('Service not initialized, attempting to initialize', {
          searchId
        });
        await this.initialize();
      }

      // Get enabled sources
      const sources = this.loyaltyManager.getEnabledSources();
      
      if (sources.length === 0) {
        const error = new Error('No hotel search sources configured');
        this.logger.error('No search sources available', { searchId });
        throw error;
      }

      this.logger.debug('Enabled search sources', {
        searchId,
        sourceCount: sources.length,
        sources: sources.map(s => s.name)
      });

      // Convert natural language query to search parameters
      const searchParams = this.parseHotelQuery(query);
      
      this.logger.debug('Parsed search parameters', {
        searchId,
        params: JSON.stringify(searchParams)
      });

      // Search all sources in parallel
      const searchPromises = sources.map(source => 
        this.loyaltyManager.extractHotels(source.id, searchParams)
          .then(result => {
            this.logger.debug(`Search completed for source: ${source.name}`, {
              searchId,
              source: source.name,
              resultCount: result.data?.length || 0
            });
            return { data: result.data || [], source: source.name };
          })
          .catch(error => {
            this.logger.error(`Error searching source: ${source.name}`, {
              searchId,
              source: source.name,
              error: error.message,
              stack: error.stack
            });
            return { data: [], source: source.name };
          })
      );

      // Wait for all searches to complete
      const results = await Promise.all(searchPromises);

      // Combine results
      const allHotels = [];
      const seenHotels = new Set();

      for (const result of results) {
        if (result.data && Array.isArray(result.data)) {
          for (const hotel of result.data) {
            // Generate unique key for hotel
            const hotelKey = `${hotel.name}|${hotel.location}`.toLowerCase();
            
            if (!seenHotels.has(hotelKey)) {
              seenHotels.add(hotelKey);
              allHotels.push({
                ...hotel,
                source: result.source
              });
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      
      this.logger.info('Search completed successfully', {
        searchId,
        duration,
        totalResults: allHotels.length,
        sourceBreakdown: results.reduce((acc, result) => {
          acc[result.source] = result.data.length;
          return acc;
        }, {})
      });

      return {
        source: 'hotels',
        providers: sources.map(s => s.name),
        results: allHotels,
        timestamp: new Date(),
        query: query,
        parameters: searchParams,
        timing: {
          duration,
          timestamp: new Date()
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('Search failed', {
        searchId,
        duration,
        error: error.message,
        stack: error.stack,
        query,
        options: JSON.stringify(options)
      });

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
    // For now, use improved basic parsing
    const params = {};
    
    // Convert query to lowercase for case-insensitive matching
    const normalizedQuery = query.toLowerCase();
    
    // Extract location - improved regex pattern for more location formats
    // Match patterns like: "in New York", "at Miami Beach", "near Central Park"
    // Also handles multi-word locations with spaces
    const locationPatterns = [
      /\b(?:in|at|near|around|by)\s+([a-zA-Z\s.',-]+?)(?:\s+from|\s+to|\s+between|\s+with|\s+for|\s+\d|\s*$)/i,
      /\blocation\s*(?::|is|in|at|near)\s+([a-zA-Z\s.',-]+?)(?:\s+from|\s+to|\s+between|\s+with|\s+for|\s+\d|\s*$)/i,
    ];
    
    for (const pattern of locationPatterns) {
      const match = normalizedQuery.match(pattern);
      if (match && match[1]) {
        params.location = match[1].trim();
        break;
      }
    }
    
    // If no location found using the patterns above, try extracting known city names
    if (!params.location) {
      const commonCities = [
        'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 
        'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 
        'san francisco', 'columbus', 'indianapolis', 'fort worth', 'charlotte', 
        'seattle', 'denver', 'washington', 'boston', 'el paso', 'nashville', 
        'las vegas', 'detroit', 'miami', 'london', 'paris', 'tokyo', 'sydney'
      ];
      
      for (const city of commonCities) {
        if (normalizedQuery.includes(city)) {
          params.location = city;
          break;
        }
      }
    }
    
    // Extract dates - improved pattern matching
    // Match formats like: "from May 10 to May 15", "between June 2 and June 10"
    const datePatterns = [
      /(?:from|between|starting)\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)\s+(?:to|and|until|through|ending|end date|-)?\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
      /(?:arriving|arrival|checkin|check-in|check in)\s+(?:on|date|at)?\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i,
      /(?:departing|departure|checkout|check-out|check out)\s+(?:on|date|at)?\s+(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/i
    ];
    
    // Try to match full date range first
    const dateRangeMatch = normalizedQuery.match(datePatterns[0]);
    if (dateRangeMatch) {
      params.checkIn = dateRangeMatch[1];
      params.checkOut = dateRangeMatch[2];
    } else {
      // Try to match individual check-in or check-out dates
      const checkInMatch = normalizedQuery.match(datePatterns[1]);
      const checkOutMatch = normalizedQuery.match(datePatterns[2]);
      
      if (checkInMatch) {
        params.checkIn = checkInMatch[1];
      }
      
      if (checkOutMatch) {
        params.checkOut = checkOutMatch[1];
      }
    }
    
    // Extract guest count and room count
    const guestMatch = normalizedQuery.match(/(\d+)\s+(?:guest|guests|people|person|adult|adults)/i);
    if (guestMatch) {
      params.guests = parseInt(guestMatch[1], 10);
    }
    
    const roomMatch = normalizedQuery.match(/(\d+)\s+(?:room|rooms)/i);
    if (roomMatch) {
      params.rooms = parseInt(roomMatch[1], 10);
    }
    
    // Extract hotel star rating
    const starMatch = normalizedQuery.match(/(\d+)[\s-]*star/i);
    if (starMatch) {
      params.stars = parseInt(starMatch[1], 10);
    }
    
    // Extract price range
    const pricePatterns = [
      /(?:under|less than|below|max|maximum)\s+\$?(\d+)/i,
      /(?:above|over|more than|min|minimum)\s+\$?(\d+)/i,
      /(?:between)\s+\$?(\d+)\s+and\s+\$?(\d+)/i,
      /(?:budget|cheap|affordable)/i,
      /(?:luxury|upscale|high-end|expensive)/i
    ];
    
    const underMatch = normalizedQuery.match(pricePatterns[0]);
    const overMatch = normalizedQuery.match(pricePatterns[1]);
    const betweenMatch = normalizedQuery.match(pricePatterns[2]);
    const budgetMatch = normalizedQuery.match(pricePatterns[3]);
    const luxuryMatch = normalizedQuery.match(pricePatterns[4]);
    
    if (betweenMatch) {
      params.priceMin = parseInt(betweenMatch[1], 10);
      params.priceMax = parseInt(betweenMatch[2], 10);
    } else {
      if (overMatch) {
        params.priceMin = parseInt(overMatch[1], 10);
      }
      
      if (underMatch) {
        params.priceMax = parseInt(underMatch[1], 10);
      }
      
      if (budgetMatch) {
        params.priceMax = 150; // Default budget price
      }
      
      if (luxuryMatch) {
        params.priceMin = 300; // Default luxury minimum
      }
    }
    
    // Add the original query to help with context
    params.query = query;
    
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
    this.logger.info('Search cache cleared');
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