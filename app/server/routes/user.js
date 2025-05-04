const express = require('express');
const User = require('../models/user');
const SearchHistory = require('../models/search-history');
const Configuration = require('../models/configuration');
const { protect, authorize } = require('../services/auth-service');
const router = express.Router();

// All routes here are protected
router.use(protect);

// @desc    Get user profile
// @route   GET /api/user/profile
// @access  Private
router.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
          role: user.role,
          loyaltyAccounts: user.loyaltyAccounts,
          isVerified: user.isVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Update user profile
// @route   PUT /api/user/profile
// @access  Private
router.put('/profile', async (req, res, next) => {
  try {
    const { firstName, lastName, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, profilePicture },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          profilePicture: user.profilePicture,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get user preferences
// @route   GET /api/user/preferences
// @access  Private
router.get('/preferences', async (req, res, next) => {
  try {
    const config = await Configuration.getForUser(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        preferences: config,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Update user preferences
// @route   PUT /api/user/preferences
// @access  Private
router.put('/preferences', async (req, res, next) => {
  try {
    const config = await Configuration.getForUser(req.user.id);
    await config.updatePreferences(req.body);

    res.status(200).json({
      status: 'success',
      data: {
        preferences: config,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get user loyalty accounts
// @route   GET /api/user/loyalty-accounts
// @access  Private
router.get('/loyalty-accounts', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        loyaltyAccounts: user.loyaltyAccounts || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Add loyalty account
// @route   POST /api/user/loyalty-accounts
// @access  Private
router.post('/loyalty-accounts', async (req, res, next) => {
  try {
    const { program, accountNumber, status, points } = req.body;

    const user = await User.findById(req.user.id);

    // Check if account already exists for this program
    const existingIndex = user.loyaltyAccounts.findIndex(
      (account) => account.program === program
    );

    if (existingIndex !== -1) {
      // Update existing account
      user.loyaltyAccounts[existingIndex] = {
        program,
        accountNumber,
        status,
        points,
        lastUpdated: Date.now(),
      };
    } else {
      // Add new account
      user.loyaltyAccounts.push({
        program,
        accountNumber,
        status,
        points,
        lastUpdated: Date.now(),
      });
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      data: {
        loyaltyAccounts: user.loyaltyAccounts,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Remove loyalty account
// @route   DELETE /api/user/loyalty-accounts/:program
// @access  Private
router.delete('/loyalty-accounts/:program', async (req, res, next) => {
  try {
    const program = req.params.program;
    const user = await User.findById(req.user.id);

    // Filter out the account for this program
    user.loyaltyAccounts = user.loyaltyAccounts.filter(
      (account) => account.program !== program
    );

    await user.save();

    res.status(200).json({
      status: 'success',
      data: {
        loyaltyAccounts: user.loyaltyAccounts,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get all search history
// @route   GET /api/user/searches
// @access  Private
router.get('/searches', async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    // Filter by saved/all
    const filter = { userId: req.user.id };
    if (req.query.saved === 'true') {
      filter.isSaved = true;
    }

    const total = await SearchHistory.countDocuments(filter);
    const searches = await SearchHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      status: 'success',
      count: searches.length,
      pagination,
      data: {
        searches,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get single search history
// @route   GET /api/user/searches/:id
// @access  Private
router.get('/searches/:id', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        search,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Save a search
// @route   PUT /api/user/searches/:id/save
// @access  Private
router.put('/searches/:id/save', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    await search.saveSearch();

    res.status(200).json({
      status: 'success',
      data: {
        search,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Schedule a saved search
// @route   PUT /api/user/searches/:id/schedule
// @access  Private
router.put('/searches/:id/schedule', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    const { frequency, notifications } = req.body;

    await search.convertToScheduledSearch({
      frequency,
      notifications: notifications || { email: true, push: false },
    });

    res.status(200).json({
      status: 'success',
      data: {
        search,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Delete a search
// @route   DELETE /api/user/searches/:id
// @access  Private
router.delete('/searches/:id', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {},
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get user analytics (admin only)
// @route   GET /api/user/analytics
// @access  Private/Admin
router.get('/analytics', authorize('admin'), async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const searches = await SearchHistory.countDocuments();
    const savedSearches = await SearchHistory.countDocuments({ isSaved: true });
    const scheduledSearches = await SearchHistory.countDocuments({ 'schedule.enabled': true });

    const top10Locations = await SearchHistory.aggregate([
      { $match: { 'parameters.location': { $exists: true, $ne: null } } },
      { $group: { _id: '$parameters.location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const topLoyaltyPrograms = await User.aggregate([
      { $unwind: '$loyaltyAccounts' },
      { $group: { _id: '$loyaltyAccounts.program', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        userStats: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
        },
        searchStats: {
          total: searches,
          saved: savedSearches,
          scheduled: scheduledSearches,
        },
        topLocations: top10Locations,
        topLoyaltyPrograms: topLoyaltyPrograms,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 