const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/user');
const { protect } = require('../services/auth-service');
const router = express.Router();

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

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
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

    // TODO: Send verification email

    // Send token response
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: info?.message || 'Invalid credentials',
      });
    }

    // Send token response
    sendTokenResponse(user, 200, res);
  })(req, res, next);
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, async (req, res, next) => {
  try {
    // Clear refresh token in DB
    req.user.refreshToken = undefined;
    req.user.refreshTokenExpire = undefined;
    await req.user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {},
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
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
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired refresh token',
      });
    }

    // Generate new tokens
    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
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
    next(err);
  }
});

// @desc    Update user details
// @route   PUT /api/auth/update-details
// @access  Private
router.put('/update-details', protect, async (req, res, next) => {
  try {
    const { firstName, lastName, profilePicture } = req.body;

    // Update user
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

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
router.put('/update-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send new token
    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
});

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
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

    // TODO: Send email with reset URL

    res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent',
      // Include reset URL in development mode for testing
      data: process.env.NODE_ENV === 'development' ? { resetUrl } : {},
    });
  } catch (err) {
    next(err);
  }
});

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resetToken
// @access  Public
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

    // Send token response
    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
});

// @desc    Google OAuth login
// @route   GET /api/auth/google
// @access  Public
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Create JWT token
    sendTokenResponse(req.user, 200, res);
  }
);

// @desc    Facebook OAuth login
// @route   GET /api/auth/facebook
// @access  Public
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

// @desc    Facebook OAuth callback
// @route   GET /api/auth/facebook/callback
// @access  Public
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    // Create JWT token
    sendTokenResponse(req.user, 200, res);
  }
);

module.exports = router; 