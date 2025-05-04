const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../services/auth-service');
const User = require('../models/user');
const SearchHistory = require('../models/search-history');
const Conversation = require('../models/conversation');

// All routes in this file should be protected and restricted to admins
router.use(protect);
router.use(authorize('admin'));

// @desc    Get user analytics overview
// @route   GET /api/analytics/users
// @access  Private/Admin
router.get('/users', async (req, res, next) => {
  try {
    // Basic user metrics
    const totalUsers = await User.countDocuments();
    const newUsers = await User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    
    // Social login breakdown
    const googleUsers = await User.countDocuments({ googleId: { $exists: true, $ne: null } });
    const facebookUsers = await User.countDocuments({ facebookId: { $exists: true, $ne: null } });
    const appleUsers = await User.countDocuments({ appleId: { $exists: true, $ne: null } });
    const emailUsers = await User.countDocuments({ 
      googleId: { $exists: false }, 
      facebookId: { $exists: false },
      appleId: { $exists: false }
    });
    
    // User engagement
    const usersWithSearches = await SearchHistory.distinct('userId').length;
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    
    // Return combined data
    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
          withSearches: usersWithSearches,
          verified: verifiedUsers,
        },
        authMethods: {
          email: emailUsers,
          google: googleUsers,
          facebook: facebookUsers,
          apple: appleUsers,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get search analytics
// @route   GET /api/analytics/searches
// @access  Private/Admin
router.get('/searches', async (req, res, next) => {
  try {
    // Time range (default: last 30 days)
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Basic search metrics
    const totalSearches = await SearchHistory.countDocuments();
    const recentSearches = await SearchHistory.countDocuments({
      createdAt: { $gte: startDate },
    });
    const savedSearches = await SearchHistory.countDocuments({ isSaved: true });
    const scheduledSearches = await SearchHistory.countDocuments({ 'schedule.enabled': true });
    
    // Top locations
    const topLocations = await SearchHistory.aggregate([
      { $match: { 'parameters.location': { $exists: true, $ne: null } } },
      { $group: { _id: '$parameters.location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    
    // Top loyalty programs searched
    const topPrograms = await SearchHistory.aggregate([
      { $match: { loyaltyPrograms: { $exists: true, $ne: [] } } },
      { $unwind: '$loyaltyPrograms' },
      { $group: { _id: '$loyaltyPrograms', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);
    
    // Search trends over time (by day)
    const dateRange = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      return date;
    }).reverse();
    
    const searchTrends = await Promise.all(
      dateRange.map(async (date) => {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        
        const count = await SearchHistory.countDocuments({
          createdAt: { $gte: date, $lt: nextDay },
        });
        
        return {
          date: date.toISOString().split('T')[0],
          count,
        };
      })
    );
    
    // Return combined data
    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          total: totalSearches,
          recent: recentSearches,
          saved: savedSearches,
          scheduled: scheduledSearches,
        },
        topLocations,
        topPrograms,
        trends: searchTrends,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get conversation analytics
// @route   GET /api/analytics/conversations
// @access  Private/Admin
router.get('/conversations', async (req, res, next) => {
  try {
    // Time range (default: last 30 days)
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Basic conversation metrics
    const totalConversations = await Conversation.countDocuments();
    const recentConversations = await Conversation.countDocuments({
      createdAt: { $gte: startDate },
    });
    const activeConversations = await Conversation.countDocuments({ isActive: true });
    
    // Message metrics
    const totalMessages = await Conversation.aggregate([
      { $project: { messageCount: { $size: '$messages' } } },
      { $group: { _id: null, total: { $sum: '$messageCount' } } },
    ]);
    
    // Average messages per conversation
    const avgMessagesPerConversation = totalMessages.length > 0
      ? totalMessages[0].total / totalConversations
      : 0;
    
    // Most active users
    const mostActiveUsers = await Conversation.aggregate([
      { $group: { 
        _id: '$userId', 
        conversations: { $sum: 1 },
        messages: { $sum: { $size: '$messages' } }
      } },
      { $sort: { messages: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'userDetails'
      } },
      { $project: {
        userId: '$_id',
        _id: 0,
        conversations: 1,
        messages: 1,
        email: { $arrayElemAt: ['$userDetails.email', 0] },
        name: { 
          $concat: [
            { $arrayElemAt: ['$userDetails.firstName', 0] },
            ' ',
            { $arrayElemAt: ['$userDetails.lastName', 0] }
          ]
        }
      } }
    ]);
    
    // Return combined data
    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          total: totalConversations,
          recent: recentConversations,
          active: activeConversations,
          totalMessages: totalMessages.length > 0 ? totalMessages[0].total : 0,
          avgMessagesPerConversation: Math.round(avgMessagesPerConversation * 100) / 100,
        },
        mostActiveUsers,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get loyalty program analytics
// @route   GET /api/analytics/loyalty
// @access  Private/Admin
router.get('/loyalty', async (req, res, next) => {
  try {
    // Loyalty program user counts
    const loyaltyAccounts = await User.aggregate([
      { $match: { 'loyaltyAccounts.0': { $exists: true } } },
      { $unwind: '$loyaltyAccounts' },
      { $group: { _id: '$loyaltyAccounts.program', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    
    // Users with multiple programs
    const programCountByUser = await User.aggregate([
      { $project: { programCount: { $size: { $ifNull: ['$loyaltyAccounts', []] } } } },
      { $group: { _id: '$programCount', userCount: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    // Total users with loyalty accounts
    const usersWithLoyalty = await User.countDocuments({ 'loyaltyAccounts.0': { $exists: true } });
    const totalUsers = await User.countDocuments();
    
    // Return combined data
    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          usersWithLoyalty,
          usersWithoutLoyalty: totalUsers - usersWithLoyalty,
          loyaltyPercentage: Math.round((usersWithLoyalty / totalUsers) * 100),
        },
        loyaltyAccounts,
        programDistribution: programCountByUser,
      },
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Get analytics dashboard summary
// @route   GET /api/analytics/dashboard
// @access  Private/Admin
router.get('/dashboard', async (req, res, next) => {
  try {
    // Get key metrics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });
    const totalSearches = await SearchHistory.countDocuments();
    const savedSearches = await SearchHistory.countDocuments({ isSaved: true });
    const totalConversations = await Conversation.countDocuments();
    
    // Get recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('email firstName lastName createdAt');
    
    // Get recent searches
    const recentSearches = await SearchHistory.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'email firstName lastName');
    
    // Return combined data
    res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          users: {
            total: totalUsers,
            active: activeUsers,
            activePercentage: Math.round((activeUsers / totalUsers) * 100),
          },
          searches: {
            total: totalSearches,
            saved: savedSearches,
            savedPercentage: Math.round((savedSearches / totalSearches) * 100),
          },
          conversations: {
            total: totalConversations,
          },
        },
        recentUsers,
        recentSearches,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router; 