/**
 * StayCrest Data Sources Configuration
 * 
 * This file contains configuration for various data sources and APIs
 * used by the StayCrest application.
 */

const DataSources = {
  /**
   * Loyalty program sources configuration
   */
  loyaltyPrograms: {
    // GHA Discovery configuration
    ghaDiscovery: {
      id: 'gha-discovery',
      name: 'GHA Discovery',
      url: 'https://www.ghadiscovery.com',
      apiEndpoint: null, // Using web scraping
      logo: '/assets/images/logos/gha-discovery.png',
      primaryColor: '#1E3E7B',
      secondaryColor: '#E1E7F2',
      description: 'Global Hotel Alliance offering benefits across 40+ hotel brands',
      features: [
        'Discovery Dollars currency',
        'Status matching available',
        'No blackout dates',
        'Room upgrades and amenities'
      ],
      partnerBrands: ['Anantara', 'Kempinski', 'Pan Pacific', 'COMO Hotels'],
      tiers: ['Silver', 'Gold', 'Platinum', 'Titanium']
    },
    
    // Marriott Bonvoy configuration
    marriottBonvoy: {
      id: 'marriott-bonvoy',
      name: 'Marriott Bonvoy',
      url: 'https://www.marriott.com/loyalty',
      apiEndpoint: 'https://api.marriott.com/search/v1',
      logo: '/assets/images/logos/marriott-bonvoy.png',
      primaryColor: '#002F6C',
      secondaryColor: '#F0F3F8',
      description: 'Marriott International\'s loyalty program spanning 30+ hotel brands',
      features: [
        'Points and Cash redemptions',
        'PointSavers for discounted stays',
        'No blackout dates',
        'Free night certificates'
      ],
      partnerBrands: ['Westin', 'Sheraton', 'The Ritz-Carlton', 'St. Regis'],
      tiers: ['Member', 'Silver', 'Gold', 'Platinum', 'Titanium', 'Ambassador']
    },
    
    // Hilton Honors configuration
    hiltonHonors: {
      id: 'hilton-honors',
      name: 'Hilton Honors',
      url: 'https://www.hilton.com/en/hilton-honors',
      apiEndpoint: 'https://api.hilton.com/hhonors/v1/search',
      logo: '/assets/images/logos/hilton-honors.png',
      primaryColor: '#00205B',
      secondaryColor: '#F3F5F9',
      description: 'Hilton\'s guest loyalty program with benefits across 18 brands',
      features: [
        'Points & Money rewards',
        '5th night free on reward stays',
        'Room selection via app',
        'Free WiFi'
      ],
      partnerBrands: ['Conrad', 'Waldorf Astoria', 'DoubleTree', 'Hampton'],
      tiers: ['Member', 'Silver', 'Gold', 'Diamond']
    },
    
    // IHG One Rewards configuration
    ihgRewards: {
      id: 'ihg-rewards',
      name: 'IHG One Rewards',
      url: 'https://www.ihg.com/onerewards',
      apiEndpoint: 'https://apis.ihg.com/hotels/v1/search',
      logo: '/assets/images/logos/ihg-rewards.png',
      primaryColor: '#E31837',
      secondaryColor: '#FDE8EB',
      description: 'IHG Hotels & Resorts loyalty program across 17 brands',
      features: [
        'Milestone Rewards',
        'Points never expire for members with status',
        'Free breakfast for Diamond members',
        'Dedicated lounge access'
      ],
      partnerBrands: ['InterContinental', 'Holiday Inn', 'Kimpton', 'Six Senses'],
      tiers: ['Club', 'Silver', 'Gold', 'Platinum', 'Diamond']
    },
    
    // World of Hyatt configuration
    hyatt: {
      id: 'world-of-hyatt',
      name: 'World of Hyatt',
      url: 'https://world.hyatt.com',
      apiEndpoint: 'https://api.hyatt.com/search',
      logo: '/assets/images/logos/world-of-hyatt.png',
      primaryColor: '#95002B',
      secondaryColor: '#F9E6EA',
      description: 'Hyatt\'s award-winning loyalty program',
      features: [
        'No blackout dates',
        'Room upgrades',
        'Guest of Honor privilege',
        'Milestone Rewards'
      ],
      partnerBrands: ['Park Hyatt', 'Grand Hyatt', 'Andaz', 'Thompson Hotels'],
      tiers: ['Member', 'Discoverist', 'Explorist', 'Globalist']
    }
  },
  
  /**
   * Web search API configurations
   */
  webSearch: {
    defaultProvider: 'google',
    providers: {
      google: {
        name: 'Google Custom Search',
        baseUrl: '/api/search/web',
        resultsPerPage: 10
      },
      bing: {
        name: 'Bing Search',
        baseUrl: '/api/search/bing',
        resultsPerPage: 10
      }
    }
  },
  
  /**
   * Hotel aggregator APIs
   */
  hotelAggregators: {
    trivago: {
      name: 'Trivago',
      baseUrl: '/api/aggregators/trivago',
      enabled: false
    },
    kayak: {
      name: 'Kayak',
      baseUrl: '/api/aggregators/kayak',
      enabled: false
    },
    expedia: {
      name: 'Expedia',
      baseUrl: '/api/aggregators/expedia',
      enabled: false
    }
  },
  
  /**
   * API endpoints for the application
   */
  apiEndpoints: {
    auth: '/api/auth',
    user: '/api/user',
    search: '/api/search',
    chat: '/api/chat',
    loyalty: '/api/loyalty',
    analytics: '/api/analytics'
  }
};

export default DataSources; 