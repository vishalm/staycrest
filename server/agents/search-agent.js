/**
 * Search Agent for handling hotel searches
 */
class SearchAgent {
  constructor(llmProvider, searchService) {
    this.llmProvider = llmProvider;
    this.searchService = searchService;
    this.isInitialized = false;
    this.searchCache = new Map();
    this.cacheTTL = 3600000; // 1 hour in milliseconds
  }
  
  /**
   * Initialize the search agent
   */
  async initialize() {
    try {
      this.isInitialized = true;
      console.log('Search agent initialized');
    } catch (error) {
      console.error('Failed to initialize search agent:', error);
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
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(query, filters);
      
      // Check cache first
      if (this.searchCache.has(cacheKey)) {
        const cachedResult = this.searchCache.get(cacheKey);
        if (Date.now() - cachedResult.timestamp < this.cacheTTL) {
          return {
            ...cachedResult.data,
            source: 'cache',
            originalTimestamp: cachedResult.timestamp
          };
        }
      }
      
      // Extract search parameters from natural language query
      const searchParams = await this.extractSearchParameters(query, filters);
      
      // Perform the actual search using the search service
      const results = await this.searchService.search(searchParams);
      
      // Enhance results with additional information
      const enhancedResults = await this.enhanceResults(results, searchParams);
      
      // Cache the results
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        data: enhancedResults
      });
      
      return enhancedResults;
    } catch (error) {
      console.error('Error searching hotels:', error);
      throw error;
    }
  }
  
  /**
   * Extract structured search parameters from natural language query
   * @param {string} query - User's natural language query
   * @param {Object} explicitFilters - Filters explicitly provided
   * @returns {Object} Structured search parameters
   */
  async extractSearchParameters(query, explicitFilters = {}) {
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
8. Loyalty programs mentioned
9. Special requirements

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

Only include fields where you have extracted specific information from the query.
`;
    
    const response = await this.llmProvider.generateResponse(prompt, {
      temperature: 0.2,
      max_tokens: 800
    });
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                       response.match(/{[\s\S]*}/);
      
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : response;
      const params = JSON.parse(jsonString);
      
      // Merge with explicit filters (explicit filters take precedence)
      return {
        ...params,
        filters: {
          ...(params.filters || {}),
          ...(explicitFilters.filters || {})
        },
        ...explicitFilters
      };
    } catch (error) {
      console.error('Error parsing search parameters:', error);
      // Return basic parameters when parsing fails
      return {
        query,
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
      if (searchParams.loyaltyPrograms && 
          searchParams.loyaltyPrograms.includes(hotel.loyaltyProgram)) {
        score += 50;
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
    
    const prompt = `
Generate a brief summary of these hotel search results:

SEARCH CRITERIA:
${JSON.stringify(searchParams, null, 2)}

TOP RESULTS:
${JSON.stringify(top3Hotels, null, 2)}

Create a concise summary that highlights:
1. Number of hotels found
2. Price range across all results
3. Best options for loyalty program members
4. Any exceptional deals or values
5. Brief mention of top-rated properties

Keep it under 150 words, conversational, and focused on the most relevant information.
`;
    
    const summary = await this.llmProvider.generateResponse(prompt, {
      temperature: 0.7,
      max_tokens: 200
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
      const reviews = await this.searchService.getHotelReviews(hotelId);
      
      // Summarize reviews if there are many
      if (reviews.length > 5) {
        const summary = await this.summarizeReviews(reviews);
        return {
          hotelId,
          reviews: reviews.slice(0, 5), // Return only top 5 reviews
          summary,
          totalCount: reviews.length,
          timestamp: new Date()
        };
      }
      
      return {
        hotelId,
        reviews,
        totalCount: reviews.length,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error fetching reviews for hotel ${hotelId}:`, error);
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
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      cacheSize: this.searchCache.size,
      cacheTTL: this.cacheTTL
    };
  }
}

module.exports = SearchAgent; 