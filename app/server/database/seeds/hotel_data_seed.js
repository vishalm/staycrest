const ragService = require('../../services/rag-service');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/seeds.log' })
  ],
});

/**
 * Hotel data for RAG system
 */
const hotelData = [
  {
    content: `
      Marriott Bonvoy Loyalty Program
      
      Marriott Bonvoy is a hotel loyalty program that rewards you for stays at more than 7,000 properties across 30 brands worldwide.
      
      Membership Tiers:
      - Member (0-9 nights)
      - Silver Elite (10-24 nights)
      - Gold Elite (25-49 nights)
      - Platinum Elite (50-74 nights)
      - Titanium Elite (75-99 nights)
      - Ambassador Elite (100+ nights + $20k spend)
      
      Key Benefits:
      - Free Wi-Fi
      - Mobile check-in/check-out
      - Member rates
      - Points toward free nights
      - Room upgrades (Gold and above)
      - Late checkout (Silver and above)
      - Welcome gift (Platinum and above)
      - Lounge access (Platinum and above)
      
      Point Structure:
      - 10 points per dollar at most properties
      - 5 points per dollar at Element, Residence Inn, TownePlace Suites
      - 2.5 points per dollar at Homes & Villas
      
      Redemption value typically ranges from 0.5 to 1.0 cents per point.
    `,
    metadata: {
      program: 'Marriott Bonvoy',
      type: 'loyalty_program',
      brands: 'Marriott, Westin, Sheraton, Ritz-Carlton, St. Regis',
      last_updated: '2025-10-15'
    }
  },
  {
    content: `
      Hilton Honors Loyalty Program
      
      Hilton Honors is the guest loyalty program of Hilton hotels and resorts, with more than 5,000 properties across 18 brands worldwide.
      
      Membership Tiers:
      - Member (0-9 nights or 0-19,999 points)
      - Silver (10-39 nights or 20,000-39,999 points)
      - Gold (40-59 nights or 40,000-59,999 points)
      - Diamond (60+ nights or 60,000+ points)
      
      Key Benefits:
      - Free Wi-Fi
      - Digital check-in and Digital Key
      - Member discounts
      - Points toward free nights
      - Fifth night free on reward stays
      - Room upgrades (Gold and Diamond)
      - Breakfast (Gold and Diamond)
      - Executive lounge access (Diamond)
      
      Point Structure:
      - 10 base points per dollar spent on room
      - Bonus points based on elite status (Silver: 20%, Gold: 80%, Diamond: 100%)
      
      Redemption value typically ranges from 0.4 to 0.6 cents per point.
    `,
    metadata: {
      program: 'Hilton Honors',
      type: 'loyalty_program',
      brands: 'Hilton, Conrad, Waldorf Astoria, DoubleTree, Hampton',
      last_updated: '2025-09-22'
    }
  },
  {
    content: `
      IHG One Rewards Loyalty Program
      
      IHG One Rewards is the loyalty program for InterContinental Hotels Group with more than 6,000 hotels across 17 brands worldwide.
      
      Membership Tiers:
      - Club (0-9 nights)
      - Silver Elite (10-19 nights)
      - Gold Elite (20-39 nights)
      - Platinum Elite (40-69 nights)
      - Diamond Elite (70+ nights)
      
      Key Benefits:
      - Free internet
      - Member rates
      - Points toward free nights
      - Reward night discounts
      - Room upgrades (Gold and above)
      - Extended checkout (Silver and above)
      - Dedicated customer service (Platinum and Diamond)
      - Welcome amenity (Platinum and Diamond)
      
      Point Structure:
      - 10 base points per dollar spent (excluding tax)
      - Bonus points based on elite status (Silver: 20%, Gold: 40%, Platinum: 60%, Diamond: 100%)
      
      Redemption value typically ranges from 0.4 to 0.7 cents per point.
    `,
    metadata: {
      program: 'IHG One Rewards',
      type: 'loyalty_program',
      brands: 'InterContinental, Kimpton, Holiday Inn, Crowne Plaza, Hotel Indigo',
      last_updated: '2025-11-05'
    }
  },
  {
    content: `
      World of Hyatt Loyalty Program
      
      World of Hyatt is the loyalty program of Hyatt Hotels Corporation, with more than 1,000 properties across 20 brands worldwide.
      
      Membership Tiers:
      - Member (0-9 nights or 0-24,999 points)
      - Discoverist (10-29 nights or 25,000-49,999 points)
      - Explorist (30-59 nights or 50,000-99,999 points)
      - Globalist (60+ nights or 100,000+ points)
      
      Key Benefits:
      - Free Wi-Fi
      - Member rates
      - Points toward free nights
      - Waived resort fees on award stays
      - Room upgrades (all elite tiers)
      - Late checkout (all elite tiers)
      - Club lounge access (Globalist)
      - Breakfast (Globalist)
      - Guest of Honor benefit (Globalist)
      
      Point Structure:
      - 5 base points per dollar spent
      - Bonus points based on elite status (Discoverist: 10%, Explorist: 20%, Globalist: 30%)
      
      Redemption value typically ranges from 1.5 to 2.0 cents per point, making it one of the most valuable hotel loyalty programs.
    `,
    metadata: {
      program: 'World of Hyatt',
      type: 'loyalty_program',
      brands: 'Hyatt, Park Hyatt, Grand Hyatt, Andaz, Thompson',
      last_updated: '2025-10-30'
    }
  },
  {
    content: `
      The Westin New York Grand Central
      
      Location: 212 East 42nd Street, New York, NY 10017
      Loyalty Program: Marriott Bonvoy
      
      The Westin New York Grand Central is a modern hotel located in the heart of Midtown Manhattan, just steps from Grand Central Terminal.
      
      Hotel Amenities:
      - 24-hour fitness center with Peloton bikes
      - Business center
      - THE LCL: Bar & Kitchen restaurant
      - Meeting and event spaces
      - Pet-friendly accommodations
      
      Room Features:
      - Westin Heavenly® Bed
      - Westin Heavenly® Bath
      - 42-inch flat-screen TV
      - Workspace with desk
      - Coffee maker
      - Mini-fridge
      
      Nearby Attractions:
      - Grand Central Terminal (0.1 miles)
      - Chrysler Building (0.1 miles)
      - United Nations Headquarters (0.5 miles)
      - Bryant Park (0.6 miles)
      - Times Square (0.8 miles)
      
      Marriott Bonvoy Category: 6
      Points Required: 40,000-60,000 points per night
    `,
    metadata: {
      name: 'The Westin New York Grand Central',
      location: 'New York, NY',
      brand: 'Westin',
      parent_company: 'Marriott',
      type: 'hotel_property',
      loyalty_program: 'Marriott Bonvoy',
      last_updated: '2025-08-25'
    }
  },
  {
    content: `
      Conrad London St. James
      
      Location: 22-28 Broadway, Westminster, London, SW1H 0BH, United Kingdom
      Loyalty Program: Hilton Honors
      
      The Conrad London St. James is a luxury hotel located in the heart of Westminster, offering sophisticated accommodations with modern amenities.
      
      Hotel Amenities:
      - Blue Boar Restaurant
      - Emmeline's Lounge for afternoon tea
      - Executive lounge (for eligible guests)
      - 24-hour fitness center
      - Business center
      - Concierge service
      
      Room Features:
      - Luxury bedding
      - 42-inch satellite TV
      - Nespresso machine
      - Marble bathroom
      - Walk-in shower
      - Bathroom TV
      
      Nearby Attractions:
      - Westminster Abbey (0.3 miles)
      - Buckingham Palace (0.5 miles)
      - Big Ben and Houses of Parliament (0.3 miles)
      - St. James's Park (0.2 miles)
      - London Eye (0.8 miles)
      
      Hilton Honors Category: Premium
      Points Required: Approximately 70,000-95,000 points per night
    `,
    metadata: {
      name: 'Conrad London St. James',
      location: 'London, UK',
      brand: 'Conrad',
      parent_company: 'Hilton',
      type: 'hotel_property',
      loyalty_program: 'Hilton Honors',
      last_updated: '2025-09-18'
    }
  },
  {
    content: `
      InterContinental Bora Bora Resort & Thalasso Spa
      
      Location: Motu Piti Aau, Bora Bora, French Polynesia
      Loyalty Program: IHG One Rewards
      
      The InterContinental Bora Bora Resort & Thalasso Spa is a luxury resort featuring overwater villas with stunning views of Mount Otemanu.
      
      Hotel Amenities:
      - Deep Ocean Spa
      - Outdoor swimming pool
      - Fitness center
      - Multiple dining options
      - Water sports
      - Diving center
      - Coral nursery
      
      Room Features:
      - Overwater villas with glass floor sections
      - Private terrace with direct lagoon access
      - Separate living area
      - Soaking tub with lagoon views
      - King-size bed
      - Premium entertainment system
      
      Activities:
      - Snorkeling in coral gardens
      - Paddleboarding
      - Kayaking
      - Scuba diving
      - Cultural experiences
      - Sunset cruises
      
      IHG One Rewards Category: Premium
      Points Required: Approximately 70,000-100,000 points per night
    `,
    metadata: {
      name: 'InterContinental Bora Bora Resort & Thalasso Spa',
      location: 'Bora Bora, French Polynesia',
      brand: 'InterContinental',
      parent_company: 'IHG',
      type: 'hotel_property',
      loyalty_program: 'IHG One Rewards',
      last_updated: '2025-07-12'
    }
  },
  {
    content: `
      Park Hyatt Tokyo
      
      Location: 3-7-1-2 Nishi Shinjuku, Shinjuku-Ku, Tokyo, 163-1055, Japan
      Loyalty Program: World of Hyatt
      
      The Park Hyatt Tokyo is a luxury hotel occupying the top 14 floors of the 52-story Shinjuku Park Tower, offering panoramic views of Tokyo and Mount Fuji.
      
      Hotel Amenities:
      - Club On The Park spa and fitness center
      - Indoor swimming pool
      - Three restaurants and two bars
      - Library lounge
      - Business center
      - Wedding and event spaces
      
      Room Features:
      - Deep soaking tubs
      - Egyptian cotton linens
      - Minibar
      - Bluetooth speaker
      - 40-inch or larger TV
      - Luxury bath amenities
      
      Nearby Attractions:
      - Shinjuku Gyoen National Garden
      - Meiji Shrine
      - Tokyo Metropolitan Government Building
      - Shibuya Crossing
      - Yoyogi Park
      
      World of Hyatt Category: 7
      Points Required: 30,000 points per night
      
      Famous for appearing in the movie "Lost in Translation."
    `,
    metadata: {
      name: 'Park Hyatt Tokyo',
      location: 'Tokyo, Japan',
      brand: 'Park Hyatt',
      parent_company: 'Hyatt',
      type: 'hotel_property',
      loyalty_program: 'World of Hyatt',
      last_updated: '2025-10-05'
    }
  }
];

/**
 * Seed the database with hotel data
 */
async function seedHotelData() {
  try {
    // Initialize RAG service
    await ragService.initialize();
    
    logger.info('Starting hotel data seeding...');
    
    // Store each hotel data document
    const storedCount = await ragService.storeDocumentBatch(hotelData);
    
    logger.info(`Successfully seeded ${storedCount} hotel data documents`);
    return true;
  } catch (error) {
    logger.error(`Error seeding hotel data: ${error.message}`);
    return false;
  }
}

// Execute if run directly
if (require.main === module) {
  seedHotelData()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('Seed failed:', error);
      process.exit(1);
    });
}

module.exports = { seedHotelData }; 