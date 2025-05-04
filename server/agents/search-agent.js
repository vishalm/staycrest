/**
 * Search Agent for handling hotel searches
 */
const logger = require('../services/logging-service').getLogger('search-agent');
const { metrics } = require('../routes/health');
const SearchSources = require('../config/search-sources');

class SearchAgent {
  constructor(llmProvider, searchService) {
    this.llmProvider = llmProvider;
    this.searchService = searchService;
    this.isInitialized = false;
    this.searchCache = new Map();
    this.cacheTTL = 3600000; // 1 hour in milliseconds
    this.logger = logger;
    this.searchSources = SearchSources;
    
    // Add diagnostic information
    this.diagnostics = {
      lastError: null,
      lastSearchParams: null,
      lastQuery: null,
      searchAttempts: 0,
      searchSuccess: 0,
      searchErrors: 0,
      llmErrors: 0,
      serviceErrors: 0
    };
    
    // Safe metrics helper - prevents errors when metrics aren't available
    this.safeMetrics = {
      increment: (metric, labels) => {
        try {
          if (metrics && metrics[metric] && typeof metrics[metric].inc === 'function') {
            metrics[metric].inc(labels);
          }
        } catch (error) {
          // Silently ignore metrics errors
        }
      },
      observe: (metric, labels, value) => {
        try {
          if (metrics && metrics[metric] && typeof metrics[metric].observe === 'function') {
            metrics[metric].observe(labels, value);
          }
        } catch (error) {
          // Silently ignore metrics errors
        }
      },
      set: (metric, labels, value) => {
        try {
          if (metrics && metrics[metric] && typeof metrics[metric].set === 'function') {
            metrics[metric].set(labels, value);
          }
        } catch (error) {
          // Silently ignore metrics errors
        }
      }
    };
    
    this.logger.info('Search agent created', {
      hasDependencies: {
        llmProvider: !!llmProvider,
        searchService: !!searchService
      }
    });
  }
  
  /**
   * Initialize the search agent
   */
  async initialize() {
    try {
      this.logger.info('Initializing search agent');
      
      // Check if LLM provider is available
      if (!this.llmProvider) {
        throw new Error('LLM provider is not available');
      }
      
      // Check if search service is available
      if (!this.searchService) {
        throw new Error('Search service is not available');
      }
      
      // Verify search service has required methods
      const requiredMethods = ['search', 'getHotelReviews'];
      for (const method of requiredMethods) {
        if (typeof this.searchService[method] !== 'function') {
          throw new Error(`Search service is missing required method: ${method}`);
        }
      }
      
      this.isInitialized = true;
      this.logger.info('Search agent initialized successfully');
    } catch (error) {
      this.logger.logError(error, 'Failed to initialize search agent');
      throw error;
    }
  }
  
  /**
   * Search for hotels based on user query
   * @param {string} query - User's search query
   * @param {Object} filters - Optional search filters
   * @returns {Object} Search results
   */
  async searchHotels(query, filters = {}) {
    const searchId = `search_${Date.now()}`;
    const startTime = Date.now();
    
    // Update diagnostics
    this.diagnostics.searchAttempts++;
    this.diagnostics.lastQuery = query;
    
    this.logger.info('Starting hotel search', { 
      searchId, 
      query, 
      filterCount: Object.keys(filters).length 
    });
    
    try {
      if (!this.isInitialized) {
        this.logger.warn('Search agent not initialized, attempting to initialize', { searchId });
        await this.initialize();
      }
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(query, filters);
      
      // Check cache first
      if (this.searchCache.has(cacheKey)) {
        const cachedResult = this.searchCache.get(cacheKey);
        if (Date.now() - cachedResult.timestamp < this.cacheTTL) {
          this.logger.debug('Returning cached search results', { 
            searchId,
            cacheKey, 
            age: Date.now() - cachedResult.timestamp 
          });
          
          // Update metrics safely
          this.safeMetrics.increment('searchRequests', { source: 'cache', status: 'success' });
          
          // Update cache hit ratio
          const cacheHitRatio = this.calculateCacheHitRatio();
          this.safeMetrics.set('cacheHitRatio', {}, cacheHitRatio);
          
          this.diagnostics.searchSuccess++;
          
          return {
            ...cachedResult.data,
            source: 'cache',
            originalTimestamp: cachedResult.timestamp,
            searchId
          };
        }
      }
      
      // Extract search parameters from natural language query
      this.logger.debug('Extracting search parameters', { searchId });
      const searchParams = await this.extractSearchParameters(query, filters);
      
      // Check if we have a location to search for
      if (!searchParams.location && !searchParams.query) {
        this.logger.warn('No location found in search query', { searchId, query });
        
        // Update metrics safely
        this.safeMetrics.increment('searchErrors', { source: 'extraction', code: 'no_location' });
        
        return {
          error: true,
          message: 'No location specified in search query',
          searchId,
          query,
          timestamp: new Date()
        };
      }
      
      // Perform the actual search using the search service
      this.logger.debug('Performing search with service', { 
        searchId, 
        params: searchParams 
      });
      
      // Update metrics safely
      this.safeMetrics.increment('searchRequests', { source: 'api', status: 'pending' });
      
      const searchStart = process.hrtime();
      
      // Check if search service is available
      if (!this.searchService) {
        this.logger.error('Search service not available', { searchId });
        throw new Error('Search service not available');
      }
      
      // Check if search service has search method
      if (typeof this.searchService.search !== 'function') {
        this.logger.error('Search service missing search method', { searchId });
        throw new Error('Search service missing search method');
      }
      
      // Execute the search
      let results;
      try {
        results = await this.searchService.search(searchParams);
      } catch (error) {
        this.logger.logError(error, 'Error from search service', {
          searchId,
          searchParams
        });
        
        this.diagnostics.serviceErrors++;
        
        // Update metrics safely
        const [seconds, nanoseconds] = process.hrtime(searchStart);
        const searchLatencyMs = (seconds * 1000) + (nanoseconds / 1000000);
        
        this.safeMetrics.observe('searchLatency', { source: 'api', type: 'failed' }, searchLatencyMs / 1000);
        this.safeMetrics.increment('searchRequests', { source: 'api', status: 'error' });
        this.safeMetrics.increment('searchErrors', { source: 'api', code: error.code || 'unknown' });
        
        throw error;
      }
      
      // Calculate search latency
      const [seconds, nanoseconds] = process.hrtime(searchStart);
      const searchLatencyMs = (seconds * 1000) + (nanoseconds / 1000000);
      
      this.logger.debug('Search service response received', {
        searchId,
        latencyMs: searchLatencyMs,
        resultCount: results?.hotels?.length || 0
      });
      
      // Update metrics safely
      this.safeMetrics.observe('searchLatency', { source: 'api', type: 'success' }, searchLatencyMs / 1000);
      this.safeMetrics.increment('searchRequests', { source: 'api', status: 'success' });
      
      if (!results) {
        this.logger.error('Search service returned null results', { searchId });
        throw new Error('Search service returned null results');
      }
      
      if (!results.hotels) {
        this.logger.warn('Search results missing hotels array', { 
          searchId, 
          resultKeys: Object.keys(results) 
        });
        
        // Add empty hotels array if missing
        results.hotels = [];
      }
      
      this.logger.debug('Search completed', { 
        searchId,
        hotelCount: results.hotels.length 
      });
      
      // Enhance results with additional information
      this.logger.debug('Enhancing search results', { searchId });
      const enhancedResults = await this.enhanceResults(results, searchParams);
      
      // Cache the results
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: enhancedResults
      });
      
      const duration = Date.now() - startTime;
      this.logger.logEvent('info', 'Hotel search completed', {
        searchId,
        query,
        filters: Object.keys(filters),
        resultsCount: enhancedResults.hotels?.length || 0,
        location: searchParams.location
      }, {
        duration,
        cacheSize: this.searchCache.size,
        searchLatencyMs
      });
      
      // Update diagnostics
      this.diagnostics.searchSuccess++;
      
      // Add searchId to results
      return {
        ...enhancedResults,
        searchId
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.logError(error, 'Error searching hotels', { 
        searchId,
        query, 
        filters,
        duration
      });
      
      // Update diagnostics
      this.diagnostics.searchErrors++;
      this.diagnostics.lastError = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
        query,
        searchId
      };
      
      // Return error response
      return {
        error: true,
        message: error.message,
        searchId,
        query,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Extract structured search parameters from natural language query
   * @param {string} query - User's natural language query
   * @param {Object} explicitFilters - Filters explicitly provided
   * @returns {Object} Structured search parameters
   */
  async extractSearchParameters(query, explicitFilters = {}) {
    const searchId = `search_${Date.now()}`;
    this.logger.info('Extracting search parameters', { query, searchId });
    
    try {
      if (!this.llmProvider) {
        this.logger.error('LLM provider not initialized', { searchId });
        
        // Fall back to basic extraction
        this.logger.info('Falling back to basic parameter extraction', { searchId });
        return {
          query,
          ...explicitFilters
        };
      }
      
      // Get available loyalty programs from configuration
      const loyaltyPrograms = Object.keys(this.searchSources.loyaltyPrograms)
        .map(key => this.searchSources.loyaltyPrograms[key].name)
        .join(', ');
      
      const prompt = `
Extract search parameters from this hotel search query:
"${query}"

Consider:
1. Location/destination
2. Check-in and check-out dates
3. Number of guests
4. Number of rooms
5. Price range
6. Hotel amenities
7. Star rating
8. Special requirements

Available loyalty programs: ${loyaltyPrograms}

Format your response as a JSON object with these fields:
{
  "location": "string or null",
  "dates": {
    "checkIn": "YYYY-MM-DD or null",
    "checkOut": "YYYY-MM-DD or null"
  },
  "guests": number or null,
  "rooms": number or null,
  "filters": {
    "priceMin": number or null,
    "priceMax": number or null,
    "amenities": [strings],
    "stars": number or null,
    "hotelChains": [strings]
  },
  "loyaltyPrograms": [strings],
  "specialRequirements": [strings]
}

For loyaltyPrograms, only include programs from the list of available programs above.
Only include fields where you have extracted specific information from the query.
`;
      
      this.logger.debug('Sending prompt to LLM', { searchId, promptLength: prompt.length });
      
      // Record LLM start time for metrics
      const llmStart = process.hrtime();
      
      const response = await this.llmProvider.generateResponse(prompt, {
        temperature: 0.2,
        max_tokens: 800
      });
      
      // Calculate LLM latency
      const [seconds, nanoseconds] = process.hrtime(llmStart);
      const llmLatencyMs = (seconds * 1000) + (nanoseconds / 1000000);
      
      this.logger.debug('LLM response received', { 
        searchId, 
        responseLength: response?.length || 0,
        llmLatencyMs
      });
      
      try {
        // Extract JSON from response
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                         response.match(/{[\s\S]*}/);
        
        if (!jsonMatch) {
          this.logger.warn('No JSON found in LLM response', { searchId, response });
          throw new Error('No JSON found in LLM response');
        }
        
        const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
        
        this.logger.debug('Extracted JSON', { searchId, jsonString });
        
        const params = JSON.parse(jsonString);
        
        this.logger.info('Parameters extracted successfully', { 
          searchId, 
          location: params.location,
          hasFilters: !!params.filters
        });
        
        // Store for diagnostics
        this.diagnostics.lastSearchParams = params;
        
        // Merge with explicit filters (explicit filters take precedence)
        const mergedParams = {
          ...params,
          filters: {
            ...(params.filters || {}),
            ...(explicitFilters.filters || {})
          },
          ...explicitFilters
        };
        
        // Attempt to update metrics
        try {
          this.safeMetrics.observe('searchLatency', { source: 'llm', type: 'extraction' }, llmLatencyMs / 1000);
        } catch (e) {
          // Metrics not available, ignore
        }
        
        return mergedParams;
      } catch (error) {
        this.logger.logError(error, 'Error parsing search parameters', { 
          searchId, 
          response: response?.substring(0, 100)
        });
        
        this.diagnostics.llmErrors++;
        
        // Return basic parameters when parsing fails
        return {
          query,
          error: 'Failed to parse parameters',
          ...explicitFilters
        };
      }
    } catch (error) {
      this.logger.logError(error, 'Error extracting search parameters', { 
        searchId,
        query
      });
      
      this.diagnostics.llmErrors++;
      
      // Return basic parameters when extraction fails
      return {
        query,
        error: 'Parameter extraction failed',
        ...explicitFilters
      };
    }
  }
  
  /**
   * Enhance search results with additional information
   * @param {Object} results - Raw search results
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Enhanced results
   */
  async enhanceResults(results, searchParams) {
    try {
      // Skip enhancement if no results
      if (!results.hotels || results.hotels.length === 0) {
        return results;
      }
      
      // Get loyalty program information for relevance
      let loyaltyInfo = {};
      if (searchParams.loyaltyPrograms && searchParams.loyaltyPrograms.length > 0) {
        // Get info about the relevant loyalty programs
        loyaltyInfo = await this.searchService.getLoyaltyInfo(searchParams.loyaltyPrograms);
      }
      
      // Prioritize and rank results
      const rankedResults = this.rankResults(results.hotels, searchParams, loyaltyInfo);
      
      // Generate search summary
      const summary = await this.generateSearchSummary(rankedResults, searchParams);
      
      return {
        ...results,
        hotels: rankedResults,
        summary,
        enhanced: true,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error enhancing results:', error);
      // Return original results if enhancement fails
      return {
        ...results,
        enhanced: false,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Rank search results based on relevance
   * @param {Array} hotels - Hotel results
   * @param {Object} searchParams - Search parameters
   * @param {Object} loyaltyInfo - Loyalty program information
   * @returns {Array} Ranked hotel results
   */
  rankResults(hotels, searchParams, loyaltyInfo) {
    // Calculate score for each hotel
    const scoredHotels = hotels.map(hotel => {
      let score = 100; // Base score
      
      // Adjust score based on match to loyalty programs
      if (searchParams.loyaltyPrograms && searchParams.loyaltyPrograms.length > 0) {
        // Look for exact matches on loyalty program
        if (hotel.loyaltyProgram && searchParams.loyaltyPrograms.includes(hotel.loyaltyProgram)) {
          score += 50;
        }
        
        // Check if the hotel is part of a brand that belongs to a requested loyalty program
        const requestedPrograms = searchParams.loyaltyPrograms.map(name => {
          // Find program ID from name
          for (const key in this.searchSources.loyaltyPrograms) {
            if (this.searchSources.loyaltyPrograms[key].name === name) {
              return this.searchSources.loyaltyPrograms[key];
            }
          }
          return null;
        }).filter(program => program !== null);
        
        // Check if hotel brand is in partnerBrands of any requested program
        if (hotel.brand) {
          for (const program of requestedPrograms) {
            if (program.partnerBrands && program.partnerBrands.includes(hotel.brand)) {
              score += 30;
              break;
            }
          }
        }
      }
      
      // Adjust score based on star rating
      if (searchParams.filters && searchParams.filters.stars) {
        if (hotel.stars === searchParams.filters.stars) {
          score += 30;
        } else {
          score -= Math.abs(hotel.stars - searchParams.filters.stars) * 10;
        }
      }
      
      // Adjust score based on price range
      if (searchParams.filters && searchParams.filters.priceMax && 
          hotel.price > searchParams.filters.priceMax) {
        score -= 40;
      }
      
      // Adjust score based on amenities
      if (searchParams.filters && searchParams.filters.amenities) {
        const foundAmenities = searchParams.filters.amenities.filter(
          amenity => hotel.amenities && hotel.amenities.includes(amenity)
        );
        
        score += foundAmenities.length * 5;
      }
      
      return { ...hotel, relevanceScore: score };
    });
    
    // Sort hotels by relevance score
    return scoredHotels.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
  
  /**
   * Generate a summary of search results
   * @param {Array} hotels - Ranked hotel results
   * @param {Object} searchParams - Search parameters
   * @returns {string} Search summary
   */
  async generateSearchSummary(hotels, searchParams) {
    // Only generate summary if we have hotels
    if (!hotels || hotels.length === 0) {
      return "No hotels found matching your criteria.";
    }
    
    const top3Hotels = hotels.slice(0, 3);
    
    // Get loyalty program information if applicable
    let loyaltyProgramsInfo = "";
    if (searchParams.loyaltyPrograms && searchParams.loyaltyPrograms.length > 0) {
      const requestedPrograms = searchParams.loyaltyPrograms.map(name => {
        // Find program from name
        for (const key in this.searchSources.loyaltyPrograms) {
          const program = this.searchSources.loyaltyPrograms[key];
          if (program.name === name) {
            return {
              name: program.name,
              description: program.description,
              features: program.features?.slice(0, 2) || [],
              pointsValue: program.pointsValue
            };
          }
        }
        return null;
      }).filter(program => program !== null);
      
      if (requestedPrograms.length > 0) {
        loyaltyProgramsInfo = `
LOYALTY PROGRAMS INFORMATION:
${JSON.stringify(requestedPrograms, null, 2)}
`;
      }
    }
    
    const prompt = `
Generate a brief summary of these hotel search results:

SEARCH CRITERIA:
${JSON.stringify(searchParams, null, 2)}

TOP RESULTS:
${JSON.stringify(top3Hotels, null, 2)}
${loyaltyProgramsInfo}

Create a concise summary that highlights:
1. Number of hotels found
2. Price range across all results
3. Best options for loyalty program members
4. Any exceptional deals or values
5. Brief mention of top-rated properties

If loyalty programs were mentioned in the search, include specific benefits that apply to these results.

Keep it under 150 words, conversational, and focused on the most relevant information.
`;
    
    const summary = await this.llmProvider.generateResponse(prompt, {
      temperature: 0.7,
      max_tokens: 250
    });
    
    return summary;
  }
  
  /**
   * Get hotel reviews
   * @param {string} hotelId - Hotel ID
   * @returns {Object} Hotel reviews
   */
  async getReviews(hotelId) {
    try {
      if (!this.searchService || typeof this.searchService.getHotelReviews !== 'function') {
        throw new Error('Hotel review service not available');
      }
      
      const reviews = await this.searchService.getHotelReviews(hotelId);
      
      // Summarize reviews if there are many and LLM is available
      if (reviews.length > 5 && this.llmProvider) {
        try {
          const summary = await this.summarizeReviews(reviews);
          return {
            hotelId,
            reviews: reviews.slice(0, 5), // Return only top 5 reviews
            summary,
            totalCount: reviews.length,
            timestamp: new Date()
          };
        } catch (error) {
          // If summary fails, just return the reviews without summary
          this.logger.warn(`Review summarization failed: ${error.message}`, { hotelId });
          return {
            hotelId,
            reviews: reviews.slice(0, 10), // Return top 10 reviews when summary fails
            totalCount: reviews.length,
            timestamp: new Date()
          };
        }
      }
      
      return {
        hotelId,
        reviews: reviews.slice(0, 10), // Cap at 10 reviews
        totalCount: reviews.length,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Error fetching reviews for hotel ${hotelId}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Summarize hotel reviews
   * @param {Array} reviews - Hotel reviews
   * @returns {Object} Review summary
   */
  async summarizeReviews(reviews) {
    const reviewTexts = reviews.map(r => r.text).slice(0, 20).join('\n\n');
    
    const prompt = `
Summarize these hotel reviews:

${reviewTexts}

Provide a summary that highlights:
1. Common positive themes
2. Common negative themes
3. Overall guest sentiment
4. Most mentioned amenities or features
5. Any consistent issues mentioned

Keep your summary concise and balanced.
`;
    
    const summary = await this.llmProvider.generateResponse(prompt, {
      temperature: 0.3,
      max_tokens: 250
    });
    
    return summary;
  }
  
  /**
   * Generate cache key from query and filters
   */
  generateCacheKey(query, filters) {
    return `search_${query}_${JSON.stringify(filters)}`;
  }
  
  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
  }
  
  /**
   * Calculate cache hit ratio
   * @returns {number} Cache hit ratio (0-1)
   */
  calculateCacheHitRatio() {
    return this.diagnostics.searchSuccess > 0 
      ? (this.diagnostics.searchSuccess - this.diagnostics.searchErrors) / this.diagnostics.searchSuccess 
      : 0;
  }
  
  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.searchCache.size,
      cacheTTL: this.cacheTTL,
      llmProviderAvailable: !!this.llmProvider,
      searchServiceAvailable: !!this.searchService,
      searchServiceStatus: this.searchService?.getStatus ? this.searchService.getStatus() : 'unknown',
      diagnostics: {
        searchAttempts: this.diagnostics.searchAttempts,
        searchSuccess: this.diagnostics.searchSuccess,
        searchErrors: this.diagnostics.searchErrors,
        llmErrors: this.diagnostics.llmErrors,
        serviceErrors: this.diagnostics.serviceErrors,
        lastError: this.diagnostics.lastError ? {
          message: this.diagnostics.lastError.message,
          timestamp: this.diagnostics.lastError.timestamp,
          query: this.diagnostics.lastError.query
        } : null
      }
    };
  }
  
  /**
   * Health check for search agent
   * @returns {Object} Health check results
   */
  async healthCheck() {
    try {
      const status = this.getStatus();
      
      // Test search with a simple query
      let searchWorking = false;
      try {
        const testResults = await this.searchHotels('test hotel in New York', { limit: 1 });
        searchWorking = testResults && testResults.hotels && testResults.hotels.length > 0;
      } catch (error) {
        this.logger.error('Health check search test failed', { error: error.message });
      }
      
      // Get available search sources
      const availableSources = {
        loyaltyPrograms: Object.keys(this.searchSources.loyaltyPrograms).filter(
          key => this.searchSources.loyaltyPrograms[key].enabled
        ).length,
        webSearch: Object.keys(this.searchSources.webSearch.providers).filter(
          key => this.searchSources.webSearch.providers[key].enabled
        ).length,
        aggregators: Object.keys(this.searchSources.hotelAggregators).filter(
          key => this.searchSources.hotelAggregators[key].enabled
        ).length,
        directBooking: Object.keys(this.searchSources.directBooking).filter(
          key => this.searchSources.directBooking[key].enabled
        ).length
      };
      
      return {
        ...status,
        healthy: this.isInitialized && searchWorking,
        searchWorking,
        availableSources,
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

module.exports = SearchAgent; 