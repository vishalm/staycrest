/**
 * StayCrest Search Sources Configuration
 * 
 * This file contains configurations for all search sources and hotel loyalty programs
 * that can be used by the StayCrest search agents. This centralized configuration
 * allows for easier management of search providers and loyalty programs.
 */

const SearchSources = {
  /**
   * Hotel Loyalty Programs
   * Complete configuration for all supported hotel loyalty programs
   */
  loyaltyPrograms: {
    // Marriott Bonvoy
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
      partnerBrands: ['Westin', 'Sheraton', 'The Ritz-Carlton', 'St. Regis', 'W Hotels'],
      tiers: ['Member', 'Silver', 'Gold', 'Platinum', 'Titanium', 'Ambassador'],
      pointsValue: 0.7, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.property-list',
        resultItem: '.property-card',
        title: '.property-name',
        description: '.property-description',
        image: '.property-image img',
        price: '.property-rate',
        rating: '.property-rating',
        location: '.property-location'
      }
    },
    
    // Hilton Honors
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
      partnerBrands: ['Conrad', 'Waldorf Astoria', 'DoubleTree', 'Hampton', 'Embassy Suites'],
      tiers: ['Member', 'Silver', 'Gold', 'Diamond'],
      pointsValue: 0.5, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.results-list',
        resultItem: '.hotel-result',
        title: '.hotel-name',
        description: '.description',
        image: '.hotel-img img',
        price: '.price-amount',
        rating: '.rating-stars',
        location: '.city-name'
      }
    },
    
    // IHG One Rewards
    ihgOneRewards: {
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
      partnerBrands: ['InterContinental', 'Holiday Inn', 'Kimpton', 'Six Senses', 'Crowne Plaza'],
      tiers: ['Club', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      pointsValue: 0.5, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.hotelList',
        resultItem: '.hotelItem',
        title: '.hotelName',
        description: '.hotelDescription',
        image: '.hotelImage img',
        price: '.price',
        rating: '.rating',
        location: '.location'
      }
    },
    
    // World of Hyatt
    worldOfHyatt: {
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
      partnerBrands: ['Park Hyatt', 'Grand Hyatt', 'Andaz', 'Thompson Hotels', 'Hyatt Regency'],
      tiers: ['Member', 'Discoverist', 'Explorist', 'Globalist'],
      pointsValue: 1.7, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '#hotelResultsWrapper',
        resultItem: '.hotel-result',
        title: '.hotel-name',
        description: '.description',
        image: '.hotel-image img',
        price: '.rate',
        rating: '.rating',
        location: '.location'
      }
    },
    
    // Accor Live Limitless
    accorLiveLimitless: {
      id: 'accor-all',
      name: 'ALL - Accor Live Limitless',
      url: 'https://all.accor.com',
      apiEndpoint: 'https://api.accor.com/hotels/v1/search',
      logo: '/assets/images/logos/accor-all.png',
      primaryColor: '#B90C5D',
      secondaryColor: '#F6E9F0',
      description: 'Accor\'s lifestyle loyalty program with over 40 hotel brands',
      features: [
        'Points never expire (with activity)',
        'Exclusive member rates',
        'Room upgrades',
        'Dining and spa rewards'
      ],
      partnerBrands: ['Sofitel', 'Novotel', 'Pullman', 'Mercure', 'ibis'],
      tiers: ['Classic', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      pointsValue: 2.0, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.hotel-list',
        resultItem: '.hotel-item',
        title: '.hotel-title',
        description: '.hotel-desc',
        image: '.hotel-img img',
        price: '.price-text',
        rating: '.hotel-rating',
        location: '.hotel-location'
      }
    },
    
    // Choice Privileges
    choicePrivileges: {
      id: 'choice-privileges',
      name: 'Choice Privileges',
      url: 'https://www.choicehotels.com/choice-privileges',
      apiEndpoint: 'https://api.choicehotels.com/search/v1',
      logo: '/assets/images/logos/choice-privileges.png',
      primaryColor: '#0078C8',
      secondaryColor: '#E5F4FF',
      description: 'Choice Hotels\' loyalty program spanning economy to upscale brands',
      features: [
        'Points for stays and partners',
        'Points that don\'t expire',
        'Free nights starting at 8,000 points',
        'Exclusive member rates'
      ],
      partnerBrands: ['Comfort', 'Quality Inn', 'Clarion', 'Cambria', 'Ascend Collection'],
      tiers: ['Member', 'Gold', 'Platinum', 'Diamond'],
      pointsValue: 0.6, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.hotel-results',
        resultItem: '.hotel-result-item',
        title: '.hotel-name',
        description: '.hotel-description',
        image: '.hotel-image img',
        price: '.rate-price',
        rating: '.hotel-rating-stars',
        location: '.hotel-address'
      }
    },
    
    // Wyndham Rewards
    wyndhamRewards: {
      id: 'wyndham-rewards',
      name: 'Wyndham Rewards',
      url: 'https://www.wyndhamhotels.com/wyndham-rewards',
      apiEndpoint: 'https://api.wyndhamhotels.com/search/v1',
      logo: '/assets/images/logos/wyndham-rewards.png',
      primaryColor: '#003366',
      secondaryColor: '#E5EBF2',
      description: 'Wyndham\'s loyalty program covering 9,000+ hotels worldwide',
      features: [
        'Free nights at 7,500, 15,000, or 30,000 points',
        'Points & Cash options',
        'No blackout dates',
        'Points that don\'t expire*'
      ],
      partnerBrands: ['Wyndham', 'Ramada', 'Days Inn', 'Super 8', 'La Quinta'],
      tiers: ['Blue', 'Gold', 'Platinum', 'Diamond'],
      pointsValue: 0.9, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.hotels-container',
        resultItem: '.hotel-item',
        title: '.hotel-title',
        description: '.hotel-description',
        image: '.hotel-image img',
        price: '.hotel-price',
        rating: '.hotel-rating',
        location: '.hotel-location'
      }
    },
    
    // Best Western Rewards
    bestWesternRewards: {
      id: 'bw-rewards',
      name: 'Best Western Rewards',
      url: 'https://www.bestwestern.com/en_US/best-western-rewards.html',
      apiEndpoint: 'https://api.bestwestern.com/search/v1',
      logo: '/assets/images/logos/bw-rewards.png',
      primaryColor: '#004990',
      secondaryColor: '#E6EDF7',
      description: 'Best Western\'s loyalty program with no blackout dates',
      features: [
        'Points never expire',
        'No blackout dates',
        'Exclusive member rates',
        'Status match with other programs'
      ],
      partnerBrands: ['Best Western', 'BW Premier', 'BW Plus', 'Executive Residency', 'Sadie'],
      tiers: ['Blue', 'Gold', 'Platinum', 'Diamond', 'Diamond Select'],
      pointsValue: 0.6, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '#hotels-results',
        resultItem: '.hotel-card',
        title: '.hotel-name',
        description: '.hotel-description',
        image: '.hotel-image img',
        price: '.rate-amount',
        rating: '.hotel-stars',
        location: '.hotel-address'
      }
    },
    
    // Radisson Rewards
    radissonRewards: {
      id: 'radisson-rewards',
      name: 'Radisson Rewards',
      url: 'https://www.radissonhotels.com/en-us/rewards',
      apiEndpoint: 'https://api.radissonhotels.com/search/v1',
      logo: '/assets/images/logos/radisson-rewards.png',
      primaryColor: '#007584',
      secondaryColor: '#E6F2F4',
      description: 'Radisson Hotel Group\'s loyalty program',
      features: [
        'Member-only rates',
        'Points for free nights',
        'Room upgrades',
        'Food & beverage discounts'
      ],
      partnerBrands: ['Radisson Blu', 'Radisson RED', 'Park Plaza', 'Park Inn', 'Country Inn'],
      tiers: ['Club', 'Silver', 'Gold', 'Platinum'],
      pointsValue: 0.4, // Cents per point value
      enabled: true,
      searchSelectors: {
        resultsContainer: '.hotels-results',
        resultItem: '.hotel-item',
        title: '.hotel-title',
        description: '.hotel-description',
        image: '.hotel-image img',
        price: '.price-value',
        rating: '.star-rating',
        location: '.location-text'
      }
    },
    
    // GHA Discovery
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
      partnerBrands: ['Anantara', 'Kempinski', 'Pan Pacific', 'COMO Hotels', 'Viceroy'],
      tiers: ['Silver', 'Gold', 'Platinum', 'Titanium'],
      pointsValue: null, // Uses Discovery Dollars, not points
      enabled: true,
      searchSelectors: {
        resultsContainer: '.hotels-container',
        resultItem: '.hotel-box',
        title: '.hotel-name',
        description: '.hotel-description',
        image: '.hotel-image img',
        price: '.rate-display',
        rating: '.hotel-rating',
        location: '.hotel-location'
      }
    }
  },
  
  /**
   * Web Search API Configurations
   * Settings for web-based hotel search providers
   */
  webSearch: {
    defaultProvider: 'google',
    providers: {
      google: {
        name: 'Google Hotels',
        baseUrl: 'https://www.google.com/travel/hotels',
        apiEndpoint: '/api/search/google',
        resultsPerPage: 10,
        enabled: true,
        requiresApiKey: true,
        features: [
          'Price comparison',
          'Date flexibility',
          'Map view',
          'User reviews',
          'Photos'
        ]
      },
      bing: {
        name: 'Bing Travel',
        baseUrl: 'https://www.bing.com/travel/hotels',
        apiEndpoint: '/api/search/bing',
        resultsPerPage: 10,
        enabled: false,
        requiresApiKey: true,
        features: [
          'Price alerts',
          'Price history',
          'Map view',
          'Filters'
        ]
      }
    }
  },
  
  /**
   * Hotel Aggregator APIs
   * Third-party aggregator services for hotel pricing and availability
   */
  hotelAggregators: {
    trivago: {
      name: 'Trivago',
      baseUrl: 'https://www.trivago.com',
      apiEndpoint: '/api/aggregators/trivago',
      enabled: true,
      requiresApiKey: true,
      features: [
        'Price comparison across 400+ booking sites',
        'Comprehensive filters',
        'Price alerts',
        'User reviews'
      ]
    },
    kayak: {
      name: 'Kayak',
      baseUrl: 'https://www.kayak.com/hotels',
      apiEndpoint: '/api/aggregators/kayak',
      enabled: true,
      requiresApiKey: true,
      features: [
        'Price alerts',
        'Heatmaps',
        'Flexible dates',
        'Price forecasting'
      ]
    },
    expedia: {
      name: 'Expedia',
      baseUrl: 'https://www.expedia.com/Hotels',
      apiEndpoint: '/api/aggregators/expedia',
      enabled: true,
      requiresApiKey: true,
      features: [
        'Package deals',
        'Member pricing',
        'Rewards program',
        'Virtual tours'
      ]
    },
    booking: {
      name: 'Booking.com',
      baseUrl: 'https://www.booking.com',
      apiEndpoint: '/api/aggregators/booking',
      enabled: true,
      requiresApiKey: true,
      features: [
        'Free cancellation options',
        'Genius loyalty program',
        'Verified reviews',
        'Alternative stays'
      ]
    },
    hotels: {
      name: 'Hotels.com',
      baseUrl: 'https://www.hotels.com',
      apiEndpoint: '/api/aggregators/hotels',
      enabled: true,
      requiresApiKey: true,
      features: [
        'Rewards program (stay 10 nights, get 1 free)',
        'Secret prices',
        'Price guarantee',
        'Bundle discounts'
      ]
    },
    hotelsCombined: {
      name: 'HotelsCombined',
      baseUrl: 'https://www.hotelscombined.com',
      apiEndpoint: '/api/aggregators/hotelscombined',
      enabled: false,
      requiresApiKey: true,
      features: [
        'Price comparison',
        'Price alerts',
        'Multilingual support',
        'Map view'
      ]
    },
    agoda: {
      name: 'Agoda',
      baseUrl: 'https://www.agoda.com',
      apiEndpoint: '/api/aggregators/agoda',
      enabled: false,
      requiresApiKey: true,
      features: [
        'AgodaCash rewards',
        'Flash deals',
        'Asian market specialization',
        'Long-stay discounts'
      ]
    }
  },
  
  /**
   * Direct Booking Platforms
   * Official hotel websites and direct booking channels
   */
  directBooking: {
    marriott: {
      name: 'Marriott.com',
      baseUrl: 'https://www.marriott.com',
      apiEndpoint: '/api/direct/marriott',
      enabled: true,
      requiresApiKey: false,
      features: [
        'Best rate guarantee',
        'Marriott Bonvoy member rates',
        'Direct booking benefits',
        'Full hotel information'
      ]
    },
    hilton: {
      name: 'Hilton.com',
      baseUrl: 'https://www.hilton.com',
      apiEndpoint: '/api/direct/hilton',
      enabled: true,
      requiresApiKey: false,
      features: [
        'Hilton Honors discounts',
        'Price match guarantee',
        'Points & Money rewards',
        'Choose your room'
      ]
    },
    ihg: {
      name: 'IHG.com',
      baseUrl: 'https://www.ihg.com',
      apiEndpoint: '/api/direct/ihg',
      enabled: true,
      requiresApiKey: false,
      features: [
        'IHG One Rewards benefits',
        'Best price guarantee',
        'Rewards nights',
        'Book with points'
      ]
    },
    hyatt: {
      name: 'Hyatt.com',
      baseUrl: 'https://www.hyatt.com',
      apiEndpoint: '/api/direct/hyatt',
      enabled: true,
      requiresApiKey: false,
      features: [
        'World of Hyatt benefits',
        'Member discount',
        'Waived resort fees on award stays',
        'Mobile check-in'
      ]
    }
  },
  
  /**
   * API endpoints for the application
   */
  apiEndpoints: {
    search: '/api/search',
    loyalty: '/api/loyalty',
    booking: '/api/booking',
    compare: '/api/compare',
    reviews: '/api/reviews'
  }
};

module.exports = SearchSources; 