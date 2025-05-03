// server/services/loyalty-website-manager.js

const axios = require('axios');
const cheerio = require('cheerio');
const winston = require('winston');
const analyticsService = require('./analytics-service');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/loyalty.log' })
  ],
});

/**
 * Manages hotel loyalty website configurations and interactions
 */
class LoyaltyWebsiteManager {
  constructor() {
    this.sources = new Map();
    this.defaultSources = [
      {
        id: 'gha-discovery',
        name: 'GHA Discovery',
        url: 'https://www.ghadiscovery.com',
        isDefault: true,
        apiEndpoint: null,
        searchSelectors: {
          resultsContainer: '.hotels-list',
          resultItem: '.hotel-item',
          title: '.hotel-name',
          description: '.hotel-description',
          image: '.hotel-image img',
          price: '.hotel-price',
          rating: '.hotel-rating',
          location: '.hotel-location'
        },
        programInfo: {
          currency: 'Discovery Dollars',
          currencyValue: '1 D$ = 1 USD',
          earningRate: '4-7% on eligible spend',
          tiers: ['Silver', 'Gold', 'Platinum', 'Titanium']
        }
      },
      {
        id: 'marriott-bonvoy',
        name: 'Marriott Bonvoy',
        url: 'https://www.marriott.com/loyalty',
        apiEndpoint: 'https://api.marriott.com/search/v1',
        apiKey: null,
        searchSelectors: {
          resultsContainer: '.property-list',
          resultItem: '.property-card',
          title: '.property-name',
          description: '.property-description',
          image: '.property-image img',
          price: '.property-rate',
          rating: '.property-rating',
          location: '.property-location'
        },
        programInfo: {
          currency: 'Marriott Bonvoy Points',
          earningRate: '10 points per $1 at most properties',
          tiers: ['Member', 'Silver', 'Gold', 'Platinum', 'Titanium', 'Ambassador']
        }
      },
      {
        id: 'hilton-honors',
        name: 'Hilton Honors',
        url: 'https://www.hilton.com/en/hilton-honors',
        apiEndpoint: 'https://api.hilton.com/hhonors/v1/search',
        searchSelectors: {
          resultsContainer: '.results-list',
          resultItem: '.hotel-result',
          title: '.hotel-name',
          description: '.description',
          image: '.hotel-img img',
          price: '.price-amount',
          rating: '.rating-stars',
          location: '.city-name'
        },
        programInfo: {
          currency: 'Hilton Honors Points',
          earningRate: '10 points per $1 at most properties',
          tiers: ['Member', 'Silver', 'Gold', 'Diamond']
        }
      },
      {
        id: 'ihg-rewards',
        name: 'IHG One Rewards',
        url: 'https://www.ihg.com/onerewards',
        apiEndpoint: 'https://apis.ihg.com/hotels/v1/search',
        searchSelectors: {
          resultsContainer: '.hotelList',
          resultItem: '.hotelItem',
          title: '.hotelName',
          description: '.hotelDescription',
          image: '.hotelImage img',
          price: '.price',
          rating: '.rating',
          location: '.location'
        },
        programInfo: {
          currency: 'IHG Points',
          earningRate: '10 points per $1 at most properties',
          tiers: ['Club', 'Silver', 'Gold', 'Platinum', 'Diamond']
        }
      },
      {
        id: 'world-of-hyatt',
        name: 'World of Hyatt',
        url: 'https://world.hyatt.com',
        apiEndpoint: 'https://api.hyatt.com/search',
        searchSelectors: {
          resultsContainer: '#hotelResultsWrapper',
          resultItem: '.hotel-result',
          title: '.hotel-name',
          description: '.description',
          image: '.hotel-image img',
          price: '.rate',
          rating: '.rating',
          location: '.location'
        },
        programInfo: {
          currency: 'World of Hyatt Points',
          earningRate: '5 points per $1 at most properties',
          tiers: ['Member', 'Discoverist', 'Explorist', 'Globalist']
        }
      }
    ];
    
    this.userIntegrations = new Map();
    this.cacheTTL = 3600000; // 1 hour
    this.initialized = false;
    this.metrics = {
      searches: 0,
      errors: 0,
      lastSync: null,
      activeIntegrations: 0
    };
  }
  
  /**
   * Initialize manager with default sources
   */
  async initialize() {
    try {
      // Load default sources
      this.defaultSources.forEach(source => {
        this.sources.set(source.id, {
          ...source,
          lastTested: null,
          status: 'unknown',
          enabled: true
        });
      });
      
      // Load any custom sources from database
      await this.loadCustomSources();
      
      // Test source connectivity
      await this.testAllSources();
      
      this.initialized = true;
      logger.info(`Loyalty Website Manager initialized with ${this.sources.size} sources`);
      
      // Log to analytics
      analyticsService.trackEvent('loyalty_manager_initialized', {
        sourcesCount: this.sources.size,
        defaultSources: this.defaultSources.map(s => s.id)
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Loyalty Website Manager: ${error.message}`);
      analyticsService.trackError(error, { context: 'Loyalty manager initialization' });
      return false;
    }
  }
  
  /**
   * Load custom sources from storage
   */
  async loadCustomSources() {
    try {
      // Implementation would load from database or config file
      // For now, just a placeholder
      
      // Example of loading from environment variables
      const customSourcesJson = process.env.CUSTOM_LOYALTY_SOURCES;
      if (customSourcesJson) {
        try {
          const customSources = JSON.parse(customSourcesJson);
          if (Array.isArray(customSources)) {
            customSources.forEach(source => {
              this.addSource({
                ...source,
                isCustom: true
              });
            });
            logger.info(`Loaded ${customSources.length} custom loyalty sources`);
          }
        } catch (parseError) {
          logger.error(`Error parsing custom loyalty sources: ${parseError.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error loading custom sources: ${error.message}`);
    }
  }
  
  /**
   * Test connectivity of all sources
   */
  async testAllSources() {
    const results = {};
    const promises = [];
    
    for (const [id, source] of this.sources.entries()) {
      // Test each source
      promises.push(
        this.testSource(id)
          .then(result => {
            results[id] = result;
            // Update source status
            source.lastTested = new Date();
            source.status = result.success ? 'active' : 'error';
            this.sources.set(id, source);
          })
          .catch(error => {
            results[id] = {
              success: false,
              error: error.message
            };
            source.lastTested = new Date();
            source.status = 'error';
            this.sources.set(id, source);
          })
      );
    }
    
    await Promise.allSettled(promises);
    return results;
  }
  
  /**
   * Add a new source
   */
  addSource(config) {
    if (!config.id || !config.name || !config.url) {
      throw new Error('Invalid source configuration');
    }
    
    const source = {
      ...config,
      id: config.id,
      name: config.name,
      url: config.url,
      apiEndpoint: config.apiEndpoint || null,
      apiKey: config.apiKey || null,
      searchSelectors: config.searchSelectors || {},
      customHeaders: config.customHeaders || {},
      status: 'unknown',
      lastTested: null,
      enabled: config.enabled !== false,
      metadata: {
        added: new Date(),
        lastUpdated: new Date()
      }
    };
    
    this.sources.set(source.id, source);
    
    analyticsService.trackEvent('loyalty_source_added', {
      sourceId: source.id,
      sourceName: source.name,
      hasApi: !!source.apiEndpoint
    });
    
    return source;
  }
  
  /**
   * Update source configuration
   */
  updateSource(id, updates) {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source not found: ${id}`);
    }
    
    const updatedSource = {
      ...source,
      ...updates,
      metadata: {
        ...source.metadata,
        lastUpdated: new Date()
      }
    };
    
    this.sources.set(id, updatedSource);
    
    analyticsService.trackEvent('loyalty_source_updated', {
      sourceId: id,
      sourceChanged: Object.keys(updates)
    });
    
    return updatedSource;
  }
  
  /**
   * Remove a source
   */
  removeSource(id) {
    const removed = this.sources.delete(id);
    
    if (removed) {
      analyticsService.trackEvent('loyalty_source_removed', {
        sourceId: id
      });
    }
    
    return removed;
  }
  
  /**
   * Get source configuration
   */
  getSourceConfig(id) {
    return this.sources.get(id);
  }
  
  /**
   * Get all sources
   */
  getAllSources() {
    return Array.from(this.sources.values());
  }
  
  /**
   * Get enabled sources
   */
  getEnabledSources() {
    return Array.from(this.sources.values())
      .filter(source => source.enabled !== false);
  }
  
  /**
   * Test source connectivity
   */
  async testSource(id) {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source not found: ${id}`);
    }
    
    try {
      const startTime = Date.now();
      
      if (source.apiEndpoint) {
        // Test API endpoint
        const response = await axios.get(source.apiEndpoint, {
          headers: {
            'Authorization': source.apiKey ? `Bearer ${source.apiKey}` : undefined,
            ...source.customHeaders
          },
          timeout: 5000
        });
        
        const responseTime = Date.now() - startTime;
        
        return {
          success: true,
          status: response.status,
          responseTime,
          timestamp: new Date()
        };
      } else {
        // Test website accessibility
        const response = await axios.get(source.url, {
          timeout: 5000,
          headers: source.customHeaders
        });
        
        const responseTime = Date.now() - startTime;
        
        return {
          success: true,
          status: response.status,
          responseTime,
          timestamp: new Date()
        };
      }
    } catch (error) {
      analyticsService.trackError(error, { 
        context: 'Loyalty source test',
        sourceId: id,
        sourceUrl: source.url
      });
      
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Extract hotels from source
   */
  async extractHotels(id, params = {}) {
    const source = this.sources.get(id);
    if (!source) {
      throw new Error(`Source not found: ${id}`);
    }
    
    // Track search in metrics
    this.metrics.searches++;
    
    const startTime = Date.now();
    let results, error;
    
    try {
      if (source.apiEndpoint) {
        results = await this.extractViaAPI(source, params);
      } else {
        results = await this.extractViaScraping(source, params);
      }
      
      // Track successful search
      analyticsService.trackEvent('loyalty_search', {
        sourceId: id, 
        sourceName: source.name,
        params: Object.keys(params),
        resultCount: results.data.length,
        duration: Date.now() - startTime
      });
      
      return results;
    } catch (e) {
      error = e;
      this.metrics.errors++;
      
      // Track error
      analyticsService.trackError(error, {
        context: 'Loyalty hotel extraction',
        sourceId: id,
        params
      });
      
      throw error;
    }
  }
  
  /**
   * Extract data via API
   */
  async extractViaAPI(source, params) {
    try {
      const response = await axios.get(source.apiEndpoint, {
        params,
        headers: {
          'Authorization': source.apiKey ? `Bearer ${source.apiKey}` : undefined,
          ...source.customHeaders
        }
      });
      
      return {
        source: source.name,
        data: response.data,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`API extraction failed for ${source.name}: ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`API extraction failed for ${source.name}: ${error.message}`);
    }
  }
  
  /**
   * Extract data via web scraping
   */
  async extractViaScraping(source, params) {
    try {
      const url = this.buildSearchUrl(source.url, params);
      const response = await axios.get(url, { headers: source.customHeaders });
      const $ = cheerio.load(response.data);
      
      const results = [];
      const selectors = source.searchSelectors;
      
      if (!selectors || !selectors.resultsContainer || !selectors.resultItem) {
        throw new Error(`Invalid selectors configuration for ${source.name}`);
      }
      
      $(selectors.resultsContainer).find(selectors.resultItem).each((i, container) => {
        const $container = $(container);
        
        const hotel = {
          id: `${source.id}_${i}`,
          name: $container.find(selectors.title).text().trim(),
          description: $container.find(selectors.description).text().trim(),
          price: $container.find(selectors.price).text().trim(),
          image: $container.find(selectors.image).attr('src'),
          rating: $container.find(selectors.rating).text().trim(),
          location: $container.find(selectors.location).text().trim(),
          loyaltyProgram: source.id,
          loyaltyBrand: source.name,
          source: source.id,
        };
        
        results.push(hotel);
      });
      
      return {
        source: source.name,
        data: results,
        timestamp: new Date(),
        params
      };
    } catch (error) {
      logger.error(`Scraping failed for ${source.name}: ${error.message}`);
      throw new Error(`Scraping failed for ${source.name}: ${error.message}`);
    }
  }
  
  /**
   * Build search URL with parameters
   */
  buildSearchUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    
    // Add search path if provided
    if (params._path) {
      url.pathname = params._path;
      delete params._path;
    }
    
    // Add remaining parameters as query params
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });
    
    return url.toString();
  }
  
  /**
   * Register user loyalty account
   * @param {String} userId - User ID
   * @param {String} programId - Loyalty program ID
   * @param {Object} credentials - Loyalty program credentials
   * @returns {Promise<Object>} - Registration result
   */
  async registerUserAccount(userId, programId, credentials) {
    const source = this.sources.get(programId);
    if (!source) {
      throw new Error(`Loyalty program not found: ${programId}`);
    }
    
    try {
      // Store user integration info
      if (!this.userIntegrations.has(userId)) {
        this.userIntegrations.set(userId, new Map());
      }
      
      const userPrograms = this.userIntegrations.get(userId);
      
      // Store credentials securely (in a real app, encrypt these)
      userPrograms.set(programId, {
        username: credentials.username,
        // In a real app, never store raw passwords - use tokens or secure storage
        membershipId: credentials.membershipId,
        tier: credentials.tier,
        integrationDate: new Date(),
        lastSync: null,
        status: 'registered'
      });
      
      // Update metrics
      this.metrics.activeIntegrations++;
      
      // Log integration
      analyticsService.trackEvent('loyalty_account_registered', {
        userId,
        programId,
        programName: source.name
      });
      
      return {
        success: true,
        programId,
        programName: source.name,
        status: 'registered',
        timestamp: new Date()
      };
    } catch (error) {
      logger.error(`Error registering loyalty account: ${error.message}`);
      analyticsService.trackError(error, {
        context: 'Loyalty account registration',
        userId,
        programId
      });
      
      throw error;
    }
  }
  
  /**
   * Get program information
   * @param {String} programId - Loyalty program ID
   * @returns {Object} - Program information
   */
  getLoyaltyProgramInfo(programId) {
    const source = this.sources.get(programId);
    if (!source) {
      throw new Error(`Loyalty program not found: ${programId}`);
    }
    
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      programInfo: source.programInfo || {},
      tiers: source.programInfo?.tiers || []
    };
  }
  
  /**
   * Get all loyalty programs
   * @returns {Array} - All loyalty programs
   */
  getAllLoyaltyPrograms() {
    return Array.from(this.sources.values()).map(source => ({
      id: source.id,
      name: source.name,
      url: source.url,
      programInfo: source.programInfo || {},
      status: source.status,
      tiers: source.programInfo?.tiers || []
    }));
  }
  
  /**
   * Get user loyalty accounts
   * @param {String} userId - User ID
   * @returns {Array} - User's linked loyalty accounts
   */
  getUserAccounts(userId) {
    if (!this.userIntegrations.has(userId)) {
      return [];
    }
    
    const userPrograms = this.userIntegrations.get(userId);
    const accounts = [];
    
    for (const [programId, details] of userPrograms.entries()) {
      const source = this.sources.get(programId);
      if (source) {
        accounts.push({
          programId,
          programName: source.name,
          membershipId: details.membershipId,
          tier: details.tier,
          integrationDate: details.integrationDate,
          lastSync: details.lastSync,
          status: details.status
        });
      }
    }
    
    return accounts;
  }
  
  /**
   * Get source statistics
   */
  getSourceStats(id) {
    const source = this.sources.get(id);
    if (!source) return null;
    
    return {
      id: source.id,
      name: source.name,
      enabled: source.enabled !== false,
      hasAPI: !!source.apiEndpoint,
      lastTested: source.lastTested,
      status: source.status,
      lastUpdated: source.metadata?.lastUpdated,
      added: source.metadata?.added
    };
  }
  
  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      activeSourcesCount: this.getEnabledSources().length,
      totalSourcesCount: this.sources.size,
      metrics: this.metrics,
      userIntegrationsCount: this.userIntegrations.size
    };
  }
  
  /**
   * Export sources configuration
   */
  exportSources() {
    return JSON.stringify(this.getAllSources(), null, 2);
  }
  
  /**
   * Import sources configuration
   */
  importSources(jsonConfig) {
    const sources = JSON.parse(jsonConfig);
    sources.forEach(source => {
      this.addSource(source);
    });
    
    analyticsService.trackEvent('loyalty_sources_imported', {
      count: sources.length
    });
    
    return this.getAllSources();
  }
}

module.exports = new LoyaltyWebsiteManager();