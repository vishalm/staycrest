// server/routes/index.js

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../services/auth-service');

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

// @desc    Get loyalty programs list
// @route   GET /api/loyalty/programs
// @access  Public
router.get('/loyalty/programs', (req, res) => {
  // This should be from a proper database or config in production
  const programs = [
    {
      id: 'marriott-bonvoy',
      name: 'Marriott Bonvoy',
      chains: ['Marriott', 'St. Regis', 'W Hotels', 'Westin', 'Sheraton'],
      logo: 'https://example.com/bonvoy-logo.png',
      website: 'https://www.marriott.com/loyalty.mi',
    },
    {
      id: 'hilton-honors',
      name: 'Hilton Honors',
      chains: ['Hilton', 'DoubleTree', 'Hampton', 'Conrad', 'Waldorf Astoria'],
      logo: 'https://example.com/hilton-logo.png',
      website: 'https://www.hilton.com/en/hilton-honors/',
    },
    {
      id: 'ihg-rewards',
      name: 'IHG One Rewards',
      chains: ['Holiday Inn', 'InterContinental', 'Crowne Plaza', 'Hotel Indigo'],
      logo: 'https://example.com/ihg-logo.png',
      website: 'https://www.ihg.com/rewardsclub/content/us/en/home',
    },
    {
      id: 'hyatt-rewards',
      name: 'World of Hyatt',
      chains: ['Hyatt', 'Grand Hyatt', 'Park Hyatt', 'Hyatt Regency'],
      logo: 'https://example.com/hyatt-logo.png',
      website: 'https://world.hyatt.com/',
    },
    {
      id: 'accor-hotels',
      name: 'ALL - Accor Live Limitless',
      chains: ['Sofitel', 'Novotel', 'Pullman', 'Mercure', 'ibis'],
      logo: 'https://example.com/accor-logo.png',
      website: 'https://all.accor.com/',
    },
  ];

  res.status(200).json({
    status: 'success',
    count: programs.length,
    data: {
      programs,
    },
  });
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