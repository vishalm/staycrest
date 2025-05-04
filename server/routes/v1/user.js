const express = require('express');
const User = require('../../models/user');
const SearchHistory = require('../../models/search-history');
const Configuration = require('../../models/configuration');
const { protect, authorize } = require('../../services/auth-service');
const logger = require('../../services/logging-service').getLogger('user');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: User
 *   description: User profile, preferences, and loyalty program endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         fullName:
 *           type: string
 *         profilePicture:
 *           type: string
 *         role:
 *           type: string
 *           enum: [user, admin, superadmin]
 *         loyaltyAccounts:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/LoyaltyAccount'
 *         isVerified:
 *           type: boolean
 *         lastLogin:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *     LoyaltyAccount:
 *       type: object
 *       properties:
 *         program:
 *           type: string
 *           description: Loyalty program name
 *         accountNumber:
 *           type: string
 *           description: Loyalty program account number
 *         status:
 *           type: string
 *           description: Membership status
 *         points:
 *           type: number
 *           description: Current points balance
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *     Preferences:
 *       type: object
 *       properties:
 *         theme:
 *           type: string
 *           enum: [light, dark, auto]
 *         notifications:
 *           type: object
 *           properties:
 *             email:
 *               type: boolean
 *             push:
 *               type: boolean
 *         preferredCurrency:
 *           type: string
 *         defaultLocation:
 *           type: string
 *     SearchHistory:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Search history entry ID
 *         userId:
 *           type: string
 *           description: User ID who performed the search
 *         query:
 *           type: string
 *           description: The search query text
 *         parameters:
 *           type: object
 *           description: Structured search parameters
 *         resultCount:
 *           type: integer
 *           description: Number of results returned
 *         isSaved:
 *           type: boolean
 *           description: Whether the search is saved by the user
 *         schedule:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *             frequency:
 *               type: string
 *               enum: [daily, weekly, monthly]
 *             notifications:
 *               type: object
 *               properties:
 *                 email:
 *                   type: boolean
 *                 push:
 *                   type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     UserAnalytics:
 *       type: object
 *       properties:
 *         userStats:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             new:
 *               type: integer
 *             active:
 *               type: integer
 *         searchStats:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             saved:
 *               type: integer
 *             scheduled:
 *               type: integer
 *         topLocations:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               count:
 *                 type: integer
 *         topLoyaltyPrograms:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               _id:
 *                 type: string
 *               count:
 *                 type: integer
 */

// All routes here are protected
router.use(protect);

/**
 * @swagger
 * /user/profile:
 *   get:
 *     summary: Get user profile
 *     description: Returns the current user's profile information
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    logger.debug('Retrieved user profile', { 
      userId: req.user.id,
      event: 'profile_retrieved'
    });

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
    logger.error('Error retrieving user profile', { 
      userId: req.user?.id,
      error: err.message,
      event: 'profile_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the current user's profile information
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               profilePicture:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         profilePicture:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', async (req, res, next) => {
  try {
    const { firstName, lastName, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, profilePicture },
      { new: true, runValidators: true }
    );

    logger.info('User profile updated', { 
      userId: req.user.id,
      fieldsUpdated: Object.keys(req.body),
      event: 'profile_updated'
    });

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
    logger.error('Error updating user profile', { 
      userId: req.user?.id,
      error: err.message,
      event: 'profile_update_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/preferences:
 *   get:
 *     summary: Get user preferences
 *     description: Returns the current user's preference settings
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     preferences:
 *                       $ref: '#/components/schemas/Preferences'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/preferences', async (req, res, next) => {
  try {
    const config = await Configuration.getForUser(req.user.id);

    logger.debug('Retrieved user preferences', { 
      userId: req.user.id,
      event: 'preferences_retrieved'
    });

    res.status(200).json({
      status: 'success',
      data: {
        preferences: config,
      },
    });
  } catch (err) {
    logger.error('Error retrieving user preferences', { 
      userId: req.user?.id,
      error: err.message,
      event: 'preferences_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/preferences:
 *   put:
 *     summary: Update user preferences
 *     description: Updates the current user's preference settings
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Preferences'
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     preferences:
 *                       $ref: '#/components/schemas/Preferences'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/preferences', async (req, res, next) => {
  try {
    const config = await Configuration.getForUser(req.user.id);
    await config.updatePreferences(req.body);

    logger.info('User preferences updated', { 
      userId: req.user.id,
      fieldsUpdated: Object.keys(req.body),
      event: 'preferences_updated'
    });

    res.status(200).json({
      status: 'success',
      data: {
        preferences: config,
      },
    });
  } catch (err) {
    logger.error('Error updating user preferences', { 
      userId: req.user?.id,
      error: err.message,
      event: 'preferences_update_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/loyalty-accounts:
 *   get:
 *     summary: Get loyalty accounts
 *     description: Returns all loyalty program accounts linked to the user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty accounts linked to the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     loyaltyAccounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LoyaltyAccount'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/loyalty-accounts', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    logger.debug('Retrieved user loyalty accounts', { 
      userId: req.user.id,
      accountCount: user.loyaltyAccounts?.length || 0,
      event: 'loyalty_accounts_retrieved'
    });

    res.status(200).json({
      status: 'success',
      data: {
        loyaltyAccounts: user.loyaltyAccounts || [],
      },
    });
  } catch (err) {
    logger.error('Error retrieving loyalty accounts', { 
      userId: req.user?.id,
      error: err.message,
      event: 'loyalty_accounts_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/loyalty-accounts:
 *   post:
 *     summary: Add loyalty account
 *     description: Adds or updates a loyalty program account for the user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - program
 *               - accountNumber
 *             properties:
 *               program:
 *                 type: string
 *                 description: Loyalty program name
 *               accountNumber:
 *                 type: string
 *                 description: Account number or membership ID
 *               status:
 *                 type: string
 *                 description: Membership status
 *               points:
 *                 type: number
 *                 description: Current points balance
 *     responses:
 *       200:
 *         description: Loyalty account added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     loyaltyAccounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LoyaltyAccount'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/loyalty-accounts', async (req, res, next) => {
  try {
    const { program, accountNumber, status, points } = req.body;

    const user = await User.findById(req.user.id);

    // Check if account already exists for this program
    const existingIndex = user.loyaltyAccounts.findIndex(
      (account) => account.program === program
    );

    const isNew = existingIndex === -1;
    
    if (existingIndex !== -1) {
      // Update existing account
      user.loyaltyAccounts[existingIndex] = {
        program,
        accountNumber,
        status,
        points,
        lastUpdated: Date.now(),
      };
      
      logger.info('Updated existing loyalty account', { 
        userId: req.user.id,
        program,
        event: 'loyalty_account_updated'
      });
    } else {
      // Add new account
      user.loyaltyAccounts.push({
        program,
        accountNumber,
        status,
        points,
        lastUpdated: Date.now(),
      });
      
      logger.info('Added new loyalty account', { 
        userId: req.user.id,
        program,
        event: 'loyalty_account_added'
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
    logger.error('Error adding loyalty account', { 
      userId: req.user?.id,
      program: req.body?.program,
      error: err.message,
      event: 'loyalty_account_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/loyalty-accounts/{program}:
 *   delete:
 *     summary: Remove loyalty account
 *     description: Removes a loyalty program account linked to the user
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: program
 *         required: true
 *         schema:
 *           type: string
 *         description: Loyalty program name
 *     responses:
 *       200:
 *         description: Loyalty account removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     loyaltyAccounts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/LoyaltyAccount'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.delete('/loyalty-accounts/:program', async (req, res, next) => {
  try {
    const program = req.params.program;
    const user = await User.findById(req.user.id);

    // Check if account exists before removing
    const accountExists = user.loyaltyAccounts.some(account => account.program === program);
    
    // Filter out the account for this program
    user.loyaltyAccounts = user.loyaltyAccounts.filter(
      (account) => account.program !== program
    );

    await user.save();

    if (accountExists) {
      logger.info('Removed loyalty account', { 
        userId: req.user.id,
        program,
        event: 'loyalty_account_removed'
      });
    } else {
      logger.info('Attempted to remove non-existent loyalty account', { 
        userId: req.user.id,
        program,
        event: 'loyalty_account_not_found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        loyaltyAccounts: user.loyaltyAccounts,
      },
    });
  } catch (err) {
    logger.error('Error removing loyalty account', { 
      userId: req.user?.id,
      program: req.params.program,
      error: err.message,
      event: 'loyalty_account_removal_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/searches:
 *   get:
 *     summary: Get search history
 *     description: Returns the user's search history with optional filtering and pagination
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: saved
 *         schema:
 *           type: boolean
 *         description: Filter by saved searches only
 *     responses:
 *       200:
 *         description: List of search history entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 count:
 *                   type: integer
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     next:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                     prev:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     searches:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SearchHistory'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
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

    logger.debug('Retrieved user search history', { 
      userId: req.user.id,
      count: searches.length,
      page,
      limit,
      filter: Object.keys(filter).join(','),
      event: 'search_history_retrieved'
    });

    res.status(200).json({
      status: 'success',
      count: searches.length,
      pagination,
      data: {
        searches,
      },
    });
  } catch (err) {
    logger.error('Error retrieving search history', { 
      userId: req.user?.id,
      error: err.message,
      event: 'search_history_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/searches/{id}:
 *   get:
 *     summary: Get single search history entry
 *     description: Returns a specific search history entry by ID
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Search history entry ID
 *     responses:
 *       200:
 *         description: Search history entry
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     search:
 *                       $ref: '#/components/schemas/SearchHistory'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/searches/:id', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      logger.info('Search history entry not found', { 
        userId: req.user.id,
        searchId: req.params.id,
        event: 'search_history_not_found'
      });
      
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    logger.debug('Retrieved single search history entry', { 
      userId: req.user.id,
      searchId: req.params.id,
      event: 'search_history_entry_retrieved'
    });

    res.status(200).json({
      status: 'success',
      data: {
        search,
      },
    });
  } catch (err) {
    logger.error('Error retrieving search history entry', { 
      userId: req.user?.id,
      searchId: req.params.id,
      error: err.message,
      event: 'search_history_entry_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/searches/{id}/save:
 *   put:
 *     summary: Save a search
 *     description: Marks a search history entry as saved
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Search history entry ID
 *     responses:
 *       200:
 *         description: Search successfully saved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     search:
 *                       $ref: '#/components/schemas/SearchHistory'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/searches/:id/save', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      logger.info('Search not found for saving', { 
        userId: req.user.id,
        searchId: req.params.id,
        event: 'search_save_not_found'
      });
      
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    await search.saveSearch();

    logger.info('Search saved', { 
      userId: req.user.id,
      searchId: req.params.id,
      event: 'search_saved'
    });

    res.status(200).json({
      status: 'success',
      data: {
        search,
      },
    });
  } catch (err) {
    logger.error('Error saving search', { 
      userId: req.user?.id,
      searchId: req.params.id,
      error: err.message,
      event: 'search_save_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/searches/{id}/schedule:
 *   put:
 *     summary: Schedule a saved search
 *     description: Configures a saved search to run on a schedule
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Search history entry ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frequency
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   push:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Search successfully scheduled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     search:
 *                       $ref: '#/components/schemas/SearchHistory'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/searches/:id/schedule', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      logger.info('Search not found for scheduling', { 
        userId: req.user.id,
        searchId: req.params.id,
        event: 'search_schedule_not_found'
      });
      
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

    logger.info('Search scheduled', { 
      userId: req.user.id,
      searchId: req.params.id,
      frequency,
      event: 'search_scheduled'
    });

    res.status(200).json({
      status: 'success',
      data: {
        search,
      },
    });
  } catch (err) {
    logger.error('Error scheduling search', { 
      userId: req.user?.id,
      searchId: req.params.id,
      error: err.message,
      event: 'search_schedule_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/searches/{id}:
 *   delete:
 *     summary: Delete a search
 *     description: Deletes a search history entry
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Search history entry ID
 *     responses:
 *       200:
 *         description: Search successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/searches/:id', async (req, res, next) => {
  try {
    const search = await SearchHistory.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!search) {
      logger.info('Search not found for deletion', { 
        userId: req.user.id,
        searchId: req.params.id,
        event: 'search_delete_not_found'
      });
      
      return res.status(404).json({
        status: 'error',
        message: 'Search not found',
      });
    }

    logger.info('Search deleted', { 
      userId: req.user.id,
      searchId: req.params.id,
      event: 'search_deleted'
    });

    res.status(200).json({
      status: 'success',
      data: {},
    });
  } catch (err) {
    logger.error('Error deleting search', { 
      userId: req.user?.id,
      searchId: req.params.id,
      error: err.message,
      event: 'search_delete_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /user/analytics:
 *   get:
 *     summary: Get user analytics
 *     description: Returns analytics data about users and searches (admin only)
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/UserAnalytics'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
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

    logger.info('User analytics retrieved', { 
      adminId: req.user.id,
      event: 'user_analytics_retrieved'
    });

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
    logger.error('Error retrieving user analytics', { 
      userId: req.user?.id,
      error: err.message,
      event: 'user_analytics_error'
    });
    next(err);
  }
});

module.exports = router; 