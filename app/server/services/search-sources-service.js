/**
 * Search Sources Service
 * 
 * A service to manage and access search sources configuration, including
 * hotel loyalty programs, aggregators, and web search providers.
 */

const SearchSources = require('../config/search-sources');
const logger = require('./logging-service').getLogger('search-sources');

class SearchSourcesService {
  constructor() {
    this.sources = SearchSources;
    this.enabledProviders = new Map();
    this.initialized = false;
    this.logger = logger;
  }
  
  /**
   * Initialize the service and validate configuration
   */
  async initialize() {
    try {
      this.logger.info('Initializing search sources service');
      
      // Validate configuration
      this.validateConfiguration();
      
      // Build the map of enabled providers
      this.buildEnabledProvidersMap();
      
      this.initialized = true;
      this.logger.info('Search sources service initialized successfully', {
        loyaltyPrograms: this.getEnabledLoyaltyPrograms().length,
        aggregators: this.getEnabledAggregators().length,
        webSearchProviders: this.getEnabledWebSearchProviders().length,
        directBooking: this.getEnabledDirectBookingPlatforms().length
      });
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to initialize search sources service: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validate configuration format
   */
  validateConfiguration() {
    // Check that required sections exist
    const requiredSections = ['loyaltyPrograms', 'webSearch', 'hotelAggregators', 'directBooking'];
    for (const section of requiredSections) {
      if (!this.sources[section]) {
        throw new Error(`Missing required section in search sources configuration: ${section}`);
      }
    }
    
    // Validate loyalty programs
    for (const [key, program] of Object.entries(this.sources.loyaltyPrograms)) {
      if (!program.id || !program.name) {
        throw new Error(`Invalid loyalty program configuration for key: ${key}`);
      }
    }
    
    // Validate web search providers
    if (!this.sources.webSearch.providers) {
      throw new Error('Missing providers in webSearch configuration');
    }
    
    this.logger.debug('Search sources configuration validated successfully');
  }
  
  /**
   * Build map of enabled providers
   */
  buildEnabledProvidersMap() {
    // Clear the map
    this.enabledProviders.clear();
    
    // Add loyalty programs
    for (const [key, program] of Object.entries(this.sources.loyaltyPrograms)) {
      if (program.enabled !== false) {
        this.enabledProviders.set(`loyalty:${program.id}`, program);
      }
    }
    
    // Add web search providers
    for (const [key, provider] of Object.entries(this.sources.webSearch.providers)) {
      if (provider.enabled) {
        this.enabledProviders.set(`websearch:${key}`, provider);
      }
    }
    
    // Add aggregators
    for (const [key, aggregator] of Object.entries(this.sources.hotelAggregators)) {
      if (aggregator.enabled) {
        this.enabledProviders.set(`aggregator:${key}`, aggregator);
      }
    }
    
    // Add direct booking platforms
    for (const [key, platform] of Object.entries(this.sources.directBooking)) {
      if (platform.enabled) {
        this.enabledProviders.set(`direct:${key}`, platform);
      }
    }
    
    this.logger.debug(`Built enabled providers map with ${this.enabledProviders.size} entries`);
  }
  
  /**
   * Get all enabled loyalty programs
   * @returns {Array} Array of enabled loyalty programs
   */
  getEnabledLoyaltyPrograms() {
    return Object.values(this.sources.loyaltyPrograms)
      .filter(program => program.enabled !== false);
  }
  
  /**
   * Get all enabled web search providers
   * @returns {Array} Array of enabled web search providers
   */
  getEnabledWebSearchProviders() {
    return Object.entries(this.sources.webSearch.providers)
      .filter(([_, provider]) => provider.enabled)
      .map(([key, provider]) => ({ id: key, ...provider }));
  }
  
  /**
   * Get all enabled aggregators
   * @returns {Array} Array of enabled aggregators
   */
  getEnabledAggregators() {
    return Object.entries(this.sources.hotelAggregators)
      .filter(([_, aggregator]) => aggregator.enabled)
      .map(([key, aggregator]) => ({ id: key, ...aggregator }));
  }
  
  /**
   * Get all enabled direct booking platforms
   * @returns {Array} Array of enabled direct booking platforms
   */
  getEnabledDirectBookingPlatforms() {
    return Object.entries(this.sources.directBooking)
      .filter(([_, platform]) => platform.enabled)
      .map(([key, platform]) => ({ id: key, ...platform }));
  }
  
  /**
   * Get a loyalty program by ID
   * @param {string} id - Loyalty program ID
   * @returns {Object|null} Loyalty program or null if not found
   */
  getLoyaltyProgramById(id) {
    for (const [key, program] of Object.entries(this.sources.loyaltyPrograms)) {
      if (program.id === id && program.enabled !== false) {
        return program;
      }
    }
    return null;
  }
  
  /**
   * Get a loyalty program by name
   * @param {string} name - Loyalty program name
   * @returns {Object|null} Loyalty program or null if not found
   */
  getLoyaltyProgramByName(name) {
    for (const [key, program] of Object.entries(this.sources.loyaltyPrograms)) {
      if (program.name === name && program.enabled !== false) {
        return program;
      }
    }
    return null;
  }
  
  /**
   * Enable or disable a provider
   * @param {string} type - Provider type (loyalty, websearch, aggregator, direct)
   * @param {string} id - Provider ID
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {boolean} Success flag
   */
  setProviderEnabled(type, id, enabled) {
    let found = false;
    
    try {
      switch (type) {
        case 'loyalty':
          if (this.sources.loyaltyPrograms[id]) {
            this.sources.loyaltyPrograms[id].enabled = enabled;
            found = true;
          }
          break;
          
        case 'websearch':
          if (this.sources.webSearch.providers[id]) {
            this.sources.webSearch.providers[id].enabled = enabled;
            found = true;
          }
          break;
          
        case 'aggregator':
          if (this.sources.hotelAggregators[id]) {
            this.sources.hotelAggregators[id].enabled = enabled;
            found = true;
          }
          break;
          
        case 'direct':
          if (this.sources.directBooking[id]) {
            this.sources.directBooking[id].enabled = enabled;
            found = true;
          }
          break;
          
        default:
          this.logger.warn(`Unknown provider type: ${type}`);
      }
      
      // Rebuild enabled providers map
      if (found) {
        this.buildEnabledProvidersMap();
        this.logger.info(`Provider ${type}:${id} ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        this.logger.warn(`Provider ${type}:${id} not found`);
      }
      
      return found;
    } catch (error) {
      this.logger.error(`Error setting provider enabled state: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Get service status
   * @returns {Object} Service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      enabledProvidersCount: this.enabledProviders.size,
      loyaltyProgramsCount: this.getEnabledLoyaltyPrograms().length,
      webSearchProvidersCount: this.getEnabledWebSearchProviders().length,
      aggregatorsCount: this.getEnabledAggregators().length,
      directBookingPlatformsCount: this.getEnabledDirectBookingPlatforms().length
    };
  }
}

// Create singleton instance
const searchSourcesService = new SearchSourcesService();

module.exports = searchSourcesService; 