const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/user');
const { protect } = require('../../services/auth-service');
const router = express.Router();
const logger = require('../../services/logging-service').getLogger('auth');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and account management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The user's ID
 *         email:
 *           type: string
 *           description: User's email address
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         fullName:
 *           type: string
 *           description: User's full name
 *         profilePicture:
 *           type: string
 *           description: URL to user's profile picture
 *         role:
 *           type: string
 *           enum: [user, admin, superadmin]
 *           description: User's role in the system
 *       example:
 *         id: "60d21b4667d0d8992e610c85"
 *         email: "john.doe@example.com"
 *         firstName: "John"
 *         lastName: "Doe"
 *         fullName: "John Doe"
 *         profilePicture: "https://example.com/profile.jpg"
 *         role: "user"
 *     AuthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: success
 *         token:
 *           type: string
 *           description: JWT auth token
 *         refreshToken:
 *           type: string
 *           description: Refresh token for generating new auth tokens
 *         expiresIn:
 *           type: string
 *           description: Token expiration time
 *           example: "1d"
 *         user:
 *           $ref: '#/components/schemas/User'
 */

// Helper function to generate token response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  // Create refresh token
  const refreshToken = crypto.randomBytes(40).toString('hex');

  // Set refresh token expiry (7 days)
  const refreshExpire = new Date(
    Date.now() + (process.env.JWT_REFRESH_EXPIRES_IN 
      ? parseInt(process.env.JWT_REFRESH_EXPIRES_IN) * 24 * 60 * 60 * 1000 
      : 7 * 24 * 60 * 60 * 1000)
  );

  // Store refresh token in DB
  user.refreshToken = refreshToken;
  user.refreshTokenExpire = refreshExpire;
  user.save({ validateBeforeSave: false });

  logger.info(`User authenticated and token generated`, {
    userId: user._id.toString(),
    event: 'token_generated'
  });

  res.status(statusCode).json({
    status: 'success',
    token,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    user: {
      id: user._id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
    },
  });
};

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user account and returns authentication tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Email already in use or invalid input
 *       500:
 *         description: Server error
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.info(`Registration failed - email already in use`, { 
        email, 
        event: 'registration_failed'
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Email already in use',
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      // Generate verification token
      verificationToken: crypto.randomBytes(20).toString('hex'),
    });

    logger.info(`New user registered successfully`, { 
      userId: user._id.toString(),
      event: 'user_registered'
    });

    // TODO: Send verification email

    // Send token response
    sendTokenResponse(user, 201, res);
  } catch (err) {
    logger.error(`Registration error`, { 
      error: err.message,
      event: 'registration_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticates a user and returns tokens
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      logger.error(`Login error`, { 
        error: err.message,
        event: 'login_error'
      });
      return next(err);
    }

    if (!user) {
      logger.info(`Login failed - invalid credentials`, { 
        email: req.body.email,
        event: 'login_failed'
      });
      
      return res.status(401).json({
        status: 'error',
        message: info?.message || 'Invalid credentials',
      });
    }

    logger.info(`User logged in successfully`, { 
      userId: user._id.toString(),
      event: 'user_login'
    });

    // Send token response
    sendTokenResponse(user, 200, res);
  })(req, res, next);
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidates the user's refresh token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */
router.post('/logout', protect, async (req, res, next) => {
  try {
    // Clear refresh token in DB
    req.user.refreshToken = undefined;
    req.user.refreshTokenExpire = undefined;
    await req.user.save({ validateBeforeSave: false });

    logger.info(`User logged out`, { 
      userId: req.user._id.toString(),
      event: 'user_logout'
    });

    res.status(200).json({
      status: 'success',
      data: {},
    });
  } catch (err) {
    logger.error(`Logout error`, { 
      error: err.message,
      userId: req.user?._id?.toString(),
      event: 'logout_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh authentication token
 *     description: Uses a refresh token to generate a new auth token
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.info(`Token refresh failed - no token provided`, { 
        event: 'refresh_token_missing'
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Refresh token is required',
      });
    }

    // Find user with this refresh token
    const user = await User.findOne({
      refreshToken,
      refreshTokenExpire: { $gt: Date.now() },
    });

    if (!user) {
      logger.info(`Token refresh failed - invalid or expired token`, { 
        event: 'refresh_token_invalid'
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired refresh token',
      });
    }

    logger.info(`Token refreshed successfully`, { 
      userId: user._id.toString(),
      event: 'token_refreshed'
    });

    // Generate new tokens
    sendTokenResponse(user, 200, res);
  } catch (err) {
    logger.error(`Token refresh error`, { 
      error: err.message,
      event: 'refresh_token_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     description: Returns information about the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
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
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Not authenticated
 */
router.get('/me', protect, async (req, res, next) => {
  try {
    // Get complete user data (excluding password)
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
    logger.error(`Error fetching user profile`, { 
      error: err.message,
      userId: req.user?._id?.toString(),
      event: 'profile_fetch_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/update-details:
 *   put:
 *     summary: Update user details
 *     description: Updates the current user's profile information
 *     tags: [Authentication]
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
 *         description: User details updated successfully
 *       401:
 *         description: Not authenticated
 */
router.put('/update-details', protect, async (req, res, next) => {
  try {
    const { firstName, lastName, profilePicture } = req.body;

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, profilePicture },
      { new: true, runValidators: true }
    );

    logger.info(`User details updated`, { 
      userId: user._id.toString(),
      event: 'user_details_updated'
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
    logger.error(`Error updating user details`, { 
      error: err.message,
      userId: req.user?._id?.toString(),
      event: 'update_details_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/update-password:
 *   put:
 *     summary: Update password
 *     description: Changes the current user's password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Current password is incorrect or not authenticated
 */
router.put('/update-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      logger.info(`Password update failed - incorrect current password`, { 
        userId: user._id.toString(),
        event: 'password_update_failed'
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    logger.info(`User password updated`, { 
      userId: user._id.toString(),
      event: 'password_updated'
    });

    // Send new token
    sendTokenResponse(user, 200, res);
  } catch (err) {
    logger.error(`Error updating password`, { 
      error: err.message,
      userId: req.user?._id?.toString(),
      event: 'password_update_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Forgot password
 *     description: Initiates the password reset process
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: If an account with that email exists, a password reset link has been sent
 */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      logger.info(`Forgot password requested for non-existent email`, { 
        email,
        event: 'forgot_password_nonexistent'
      });
      
      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent',
      });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

    logger.info(`Password reset token generated`, { 
      userId: user._id.toString(),
      event: 'password_reset_requested'
    });

    // TODO: Send email with reset URL

    res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent',
      // Include reset URL in development mode for testing
      data: process.env.NODE_ENV === 'development' ? { resetUrl } : {},
    });
  } catch (err) {
    logger.error(`Error processing forgot password request`, { 
      error: err.message,
      event: 'forgot_password_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/reset-password/{resetToken}:
 *   put:
 *     summary: Reset password
 *     description: Resets a user's password using a token
 *     tags: [Authentication]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: resetToken
 *         required: true
 *         schema:
 *           type: string
 *         description: Password reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid or expired token
 */
router.put('/reset-password/:resetToken', async (req, res, next) => {
  try {
    const { password } = req.body;

    // Get hashed token
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');

    // Find user with this token and check if token is still valid
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      logger.info(`Password reset failed - invalid or expired token`, { 
        event: 'password_reset_invalid_token'
      });
      
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or expired token',
      });
    }

    // Set new password and clear reset fields
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.failedLoginAttempts = 0;
    user.accountLocked = false;
    await user.save();

    logger.info(`Password reset successful`, { 
      userId: user._id.toString(),
      event: 'password_reset_success'
    });

    // Send token response
    sendTokenResponse(user, 200, res);
  } catch (err) {
    logger.error(`Error processing password reset`, { 
      error: err.message,
      resetToken: req.params.resetToken,
      event: 'password_reset_error'
    });
    next(err);
  }
});

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Google OAuth login
 *     description: Initiates Google OAuth authentication
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to Google authentication
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Callback endpoint for Google OAuth
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       302:
 *         description: Redirects on authentication failure
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    logger.info(`User authenticated via Google OAuth`, { 
      userId: req.user._id.toString(),
      event: 'oauth_google_success'
    });
    
    // Create JWT token
    sendTokenResponse(req.user, 200, res);
  }
);

/**
 * @swagger
 * /auth/facebook:
 *   get:
 *     summary: Facebook OAuth login
 *     description: Initiates Facebook OAuth authentication
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirects to Facebook authentication
 */
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

/**
 * @swagger
 * /auth/facebook/callback:
 *   get:
 *     summary: Facebook OAuth callback
 *     description: Callback endpoint for Facebook OAuth
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       302:
 *         description: Redirects on authentication failure
 */
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    logger.info(`User authenticated via Facebook OAuth`, { 
      userId: req.user._id.toString(),
      event: 'oauth_facebook_success'
    });
    
    // Create JWT token
    sendTokenResponse(req.user, 200, res);
  }
);

module.exports = router; 