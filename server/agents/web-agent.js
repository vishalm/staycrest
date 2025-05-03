// server/agents/web-agent.js

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');

/**
 * Web Agent for interacting with hotel loyalty websites
 */
class WebAgent {
  constructor(llmProvider, loyaltyManager) {
    this.llmProvider = llmProvider;
    this.loyaltyManager = loyaltyManager;
    this.browser = null;
    this.cache = new Map();
  }
  
  async initialize() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Web agent initialized');
  }
  
  /**
   * Navigate to a website and extract data
   */
  async navigate(url) {
    try {
      const page = await this.browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Add request interception
      await page.setRequestInterception(true);
      page.on('request', request => {
        // Block unnecessary resources
        if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Extract page content
      const content = await page.content();
      const title = await page.title();
      
      await page.close();
      
      return {
        url,
        title,
        content,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`Error navigating to ${url}:`, error);
      throw error;
    }
  }
  
  /**
   * Extract hotel data from a loyalty program website
   */
  async extractHotelData(source) {
    const config = this.loyaltyManager.getSourceConfig(source);
    if (!config) {
      throw new Error(`Unknown source: ${source}`);
    }
    
    try {
      // Check cache first
      const cacheKey = `hotels_${source}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      let data;
      
      if (config.apiEndpoint) {
        // Use API if available
        data = await this.fetchViaAPI(config);
      } else {
        // Fallback to web scraping
        data = await this.scrapeWebsite(config);
      }
      
      // Cache the results
      this.cache.set(cacheKey, data);
      setTimeout(() => this.cache.delete(cacheKey), 3600000); // 1 hour cache
      
      return data;
    } catch (error) {
      console.error(`Error extracting data from ${source}:`, error);
      throw error;
    }
  }
  
  /**
   * Fetch data via API
   */
  async fetchViaAPI(config) {
    const response = await axios.get(config.apiEndpoint, {
      headers: {
        'Authorization': config.apiKey ? `Bearer ${config.apiKey}` : undefined,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }
  
  /**
   * Scrape website for hotel data
   */
  async scrapeWebsite(config) {
    const page = await this.browser.newPage();
    
    try {
      await page.goto(config.url, { waitUntil: 'networkidle0' });
      
      // Wait for dynamic content
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      }
      
      // Extract data using selectors
      const hotels = await page.evaluate((selectors) => {
        const results = [];
        const $ = (sel) => document.querySelectorAll(sel);
        
        $(selectors.resultsContainer).forEach(container => {
          const hotel = {};
          
          // Extract basic info
          const titleEl = container.querySelector(selectors.title);
          const descEl = container.querySelector(selectors.description);
          const priceEl = container.querySelector(selectors.price);
          const imageEl = container.querySelector(selectors.image);
          const ratingEl = container.querySelector(selectors.rating);
          const locationEl = container.querySelector(selectors.location);
          
          if (titleEl) hotel.name = titleEl.textContent.trim();
          if (descEl) hotel.description = descEl.textContent.trim();
          if (priceEl) hotel.price = priceEl.textContent.trim();
          if (imageEl) hotel.image = imageEl.src;
          if (ratingEl) hotel.rating = ratingEl.textContent.trim();
          if (locationEl) hotel.location = locationEl.textContent.trim();
          
          results.push(hotel);
        });
        
        return results;
      }, config.searchSelectors);
      
      await page.close();
      
      return {
        source: config.name,
        hotels,
        timestamp: new Date()
      };
    } catch (error) {
      await page.close();
      throw error;
    }
  }
  
  /**
   * Compare loyalty programs
   */
  async comparePrograms(programs) {
    const comparisons = await Promise.all(
      programs.map(async program => {
        const config = this.loyaltyManager.getSourceConfig(program);
        if (!config) return null;
        
        // Extract program details
        const programData = await this.extractProgramDetails(config);
        return {
          name: program,
          ...programData
        };
      })
    );
    
    // Filter out null values
    const validComparisons = comparisons.filter(c => c !== null);
    
    // Use LLM to generate comparison summary
    const comparisonPrompt = `
Compare these hotel loyalty programs:
${JSON.stringify(validComparisons, null, 2)}

Provide a clear comparison focusing on:
1. Earning rates
2. Redemption value
3. Elite status requirements
4. Special benefits
5. Best use cases
`;
    
    const summary = await this.llmProvider.generateResponse(comparisonPrompt);
    
    return {
      programs: validComparisons,
      summary
    };
  }
  
  /**
   * Extract program details
   */
  async extractProgramDetails(config) {
    const page = await this.browser.newPage();
    
    try {
      // Navigate to program page
      await page.goto(config.url + '/program-details', { waitUntil: 'networkidle0' });
      
      // Extract program information
      const programInfo = await page.evaluate(() => {
        const info = {};
        
        // Extract earning structure
        const earningEl = document.querySelector('.earning-structure, .points-earning');
        if (earningEl) info.earning = earningEl.textContent.trim();
        
        // Extract redemption info
        const redemptionEl = document.querySelector('.redemption-info, .points-redemption');
        if (redemptionEl) info.redemption = redemptionEl.textContent.trim();
        
        // Extract tier structure
        const tiersEl = document.querySelector('.tier-structure, .membership-tiers');
        if (tiersEl) info.tiers = tiersEl.textContent.trim();
        
        // Extract benefits
        const benefitsEl = document.querySelector('.benefits-list, .program-benefits');
        if (benefitsEl) info.benefits = benefitsEl.textContent.trim();
        
        return info;
      });
      
      await page.close();
      
      return programInfo;
    } catch (error) {
      await page.close();
      return {};
    }
  }
  
  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: !!this.browser,
      cacheSize: this.cache.size,
      browserConnected: this.browser && this.browser.isConnected()
    };
  }
  
  /**
   * Cleanup
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = WebAgent;