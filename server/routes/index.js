// server/routes/index.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../services/auth-service');
const searchSourcesService = require('../services/search-sources-service');
const searchAgent = require('../agents/search-agent');
const logger = require('../services/logging-service').getLogger('api-routes');

// @desc    Main API health check
// @route   GET /api
// @access  Public
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'StayCrest API is running',
    version: '1.0.0',
    time: new Date(),
  });
});

// @desc    Search hotels
// @route   GET /api/search
// @access  Public
router.get('/search', async (req, res) => {
  const requestId = `req-${Date.now()}`;
  const startTime = Date.now();

  try {
    const { q: query, location, ...filters } = req.query;

    logger.info('Received search request', {
      requestId,
      query,
      location,
      filters: JSON.stringify(filters),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    if (!query && !location) {
      logger.warn('Missing search parameters', {
        requestId,
        query,
        location
      });

      return res.status(400).json({
        status: 'error',
        message: 'Please provide a search query or location'
      });
    }

    // Combine query and location if both are provided
    const searchQuery = location ? 
      `${query || ''} in ${location}`.trim() : 
      query;

    logger.debug('Processed search query', {
      requestId,
      originalQuery: query,
      location,
      combinedQuery: searchQuery
    });

    // Execute search
    const searchResults = await searchAgent.searchHotels(searchQuery, filters);

    const duration = Date.now() - startTime;

    logger.info('Search request completed', {
      requestId,
      duration,
      resultCount: searchResults.results?.length || 0,
      query: searchQuery,
      filters: JSON.stringify(filters)
    });

    res.status(200).json({
      status: 'success',
      data: {
        query: searchQuery,
        ...searchResults
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Search request failed', {
      requestId,
      duration,
      error: error.message,
      stack: error.stack,
      query: req.query.q,
      location: req.query.location
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to process search request',
      error: error.message
    });
  }
});

// @desc    Get loyalty programs list
// @route   GET /api/loyalty/programs
// @access  Public
router.get('/loyalty/programs', (req, res) => {
  try {
    // Get loyalty programs from our centralized search sources configuration
    const programs = searchSourcesService.getEnabledLoyaltyPrograms().map(program => ({
      id: program.id,
      name: program.name,
      chains: program.partnerBrands || [],
      logo: program.logo,
      website: program.url,
      description: program.description,
      tiers: program.tiers || [],
      features: program.features || []
    }));

    res.status(200).json({
      status: 'success',
      count: programs.length,
      data: {
        programs,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve loyalty programs',
      error: error.message
    });
  }
});

// @desc    Get all search sources
// @route   GET /api/search/sources
// @access  Public
router.get('/search/sources', (req, res) => {
  const requestId = `req-${Date.now()}`;

  try {
    logger.debug('Fetching search sources', { requestId });

    const sources = {
      loyaltyPrograms: searchSourcesService.getEnabledLoyaltyPrograms(),
      webSearch: searchSourcesService.getEnabledWebSearchProviders(),
      aggregators: searchSourcesService.getEnabledAggregators(),
      directBooking: searchSourcesService.getEnabledDirectBookingPlatforms()
    };
    
    logger.info('Search sources retrieved', {
      requestId,
      sourceCounts: {
        loyaltyPrograms: sources.loyaltyPrograms.length,
        webSearch: sources.webSearch.length,
        aggregators: sources.aggregators.length,
        directBooking: sources.directBooking.length
      }
    });

    res.status(200).json({
      status: 'success',
      data: sources
    });
  } catch (error) {
    logger.error('Failed to retrieve search sources', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve search sources',
      error: error.message
    });
  }
});

// @desc    Get supported hotel chains
// @route   GET /api/hotel/chains
// @access  Public
router.get('/hotel/chains', (req, res) => {
  // This should be from a proper database or config in production
  const chains = [
    {
      id: 'marriott',
      name: 'Marriott',
      loyaltyProgram: 'marriott-bonvoy',
      website: 'https://www.marriott.com/',
    },
    {
      id: 'hilton',
      name: 'Hilton',
      loyaltyProgram: 'hilton-honors',
      website: 'https://www.hilton.com/',
    },
    {
      id: 'ihg',
      name: 'IHG',
      loyaltyProgram: 'ihg-rewards',
      website: 'https://www.ihg.com/',
    },
    {
      id: 'hyatt',
      name: 'Hyatt',
      loyaltyProgram: 'hyatt-rewards',
      website: 'https://www.hyatt.com/',
    },
    {
      id: 'accor',
      name: 'Accor',
      loyaltyProgram: 'accor-hotels',
      website: 'https://www.accor.com/',
    },
  ];

  res.status(200).json({
    status: 'success',
    count: chains.length,
    data: {
      chains,
    },
  });
});

// @desc    Health check
// @route   GET /api/health
// @access  Public
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// @desc    Get feature flags
// @route   GET /api/features
// @access  Public
router.get('/features', (req, res) => {
  // Get feature flags from environment variables
  const features = {
    savedSearches: process.env.FEATURE_SAVED_SEARCHES === 'true',
    directBooking: process.env.FEATURE_DIRECT_BOOKING === 'true',
    voiceCommands: process.env.FEATURE_VOICE_COMMANDS === 'true',
    memoryManagement: process.env.FEATURE_MEMORY_MANAGEMENT === 'true',
    userProfiles: process.env.FEATURE_USER_PROFILES === 'true',
  };

  res.status(200).json({
    status: 'success',
    data: {
      features,
    },
  });
});

// @desc    Get system status
// @route   GET /api/status
// @access  Private/Admin
router.get('/status', protect, authorize('admin'), (req, res) => {
  // This would include more real metrics in production
  const status = {
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
    },
    environment: process.env.NODE_ENV,
    services: {
      database: 'connected',
      cache: process.env.REDIS_URL ? 'connected' : 'not configured',
      llm: process.env.LLM_PROVIDER || 'not configured',
      voice: process.env.VOICE_PROVIDER || 'not configured',
    },
  };

  res.status(200).json({
    status: 'success',
    data: {
      status,
    },
  });
});

// @desc    Get API documentation
// @route   GET /api/docs
// @access  Public
router.get('/docs', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API documentation',
    data: {
      version: '1.0.0',
      baseUrl: `${req.protocol}://${req.get('host')}/api`,
      endpoints: {
        auth: {
          register: { method: 'POST', path: '/auth/register' },
          login: { method: 'POST', path: '/auth/login' },
          refreshToken: { method: 'POST', path: '/auth/refresh-token' },
          me: { method: 'GET', path: '/auth/me' },
        },
        user: {
          profile: { method: 'GET', path: '/user/profile' },
          updateProfile: { method: 'PUT', path: '/user/profile' },
          preferences: { method: 'GET', path: '/user/preferences' },
        },
        searches: {
          list: { method: 'GET', path: '/user/searches' },
          getSingle: { method: 'GET', path: '/user/searches/:id' },
          saveSearch: { method: 'PUT', path: '/user/searches/:id/save' },
        },
        hotels: {
          chains: { method: 'GET', path: '/hotel/chains' },
        },
        loyalty: {
          programs: { method: 'GET', path: '/loyalty/programs' },
        },
      },
    },
  });
});

module.exports = router;