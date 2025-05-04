const express = require('express');
const User = require('../models/user');
const { protect, authorize } = require('../services/auth-service');
const rbac = require('../services/rbac-service');
const router = express.Router();

// Apply auth middleware to all admin routes
router.use(protect);

// Get all users with pagination and filtering
router.get('/users', authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    // Check if user has permission to manage users
    if (!rbac.hasPermission(req.user, 'manage_users')) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to access user management'
      });
    }
    
    // Rest of the code remains the same
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build query based on filters
    const query = {};
    
    // Filter by role
    if (req.query.role && ['user', 'moderator', 'admin', 'superadmin'].includes(req.query.role)) {
      query.role = req.query.role;
    }
    
    // Filter by verification status
    if (req.query.isVerified !== undefined) {
      query.isVerified = req.query.isVerified === 'true';
    }
    
    // Filter by account status
    if (req.query.accountLocked !== undefined) {
      query.accountLocked = req.query.accountLocked === 'true';
    }
    
    // Filter by search term (name or email)
    if (req.query.search) {
      query.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const users = await User.find(query)
      .select('-password -refreshToken -refreshTokenExpire')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      data: {
        users
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get user by ID
router.get('/users/:id', authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    // Check if user has permission to manage users
    if (!rbac.hasPermission(req.user, 'manage_users')) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to access user details'
      });
    }
    
    const user = await User.findById(req.params.id).select('-password -refreshToken -refreshTokenExpire');
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (err) {
    next(err);
  }
});

// Create new user (admin-created)
router.post('/users', authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { 
      firstName, lastName, email, password, 
      role = 'user', isVerified = true 
    } = req.body;
    
    // Check if user has permission to manage users
    if (!rbac.hasPermission(req.user, 'manage_users')) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to create users'
      });
    }
    
    // Check if user can assign the requested role
    if (!rbac.canAssignRole(req.user, role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to assign this role'
      });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }
    
    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      isVerified
    });
    
    // Return user without sensitive fields
    const sanitizedUser = await User.findById(user.id).select('-password -refreshToken -refreshTokenExpire');
    
    res.status(201).json({
      status: 'success',
      data: {
        user: sanitizedUser
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update user
router.put('/users/:id', authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    const { 
      firstName, lastName, email, role, isVerified,
      accountLocked, password // Optional fields
    } = req.body;
    
    // Check if user has permission to manage users
    if (!rbac.hasPermission(req.user, 'manage_users')) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to update users'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Use RBAC service to check if current user can manage target user
    if (!rbac.canManageUser(req.user, user)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to modify this user'
      });
    }
    
    // Check if user can assign the new role (if changing)
    if (role && role !== user.role && !rbac.canAssignRole(req.user, role)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to assign this role'
      });
    }
    
    // Prepare update data
    const updateData = {
      firstName, 
      lastName,
      email,
      role,
      isVerified,
      accountLocked
    };
    
    // Only include password if provided
    if (password) {
      // Password is automatically hashed in the model's pre-save hook
      updateData.password = password;
      updateData.failedLoginAttempts = 0; // Reset failed login attempts when password is changed
    }
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -refreshToken -refreshTokenExpire');
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (err) {
    next(err);
  }
});

// Delete user
router.delete('/users/:id', authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    // Check if user has permission to manage users
    if (!rbac.hasPermission(req.user, 'manage_users')) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to delete users'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Use RBAC service to check if current user can manage target user
    if (!rbac.canManageUser(req.user, user)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to delete this user'
      });
    }
    
    // Prevent users from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot delete your own account'
      });
    }
    
    await user.remove();
    
    res.status(200).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
});

// Get user activity log
router.get('/users/:id/activity', authorize('admin', 'superadmin'), async (req, res, next) => {
  try {
    // Check if user has permission to manage users
    if (!rbac.hasPermission(req.user, 'manage_users')) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to view user activity'
      });
    }
    
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // This would typically fetch from an activity log collection
    // For now, we'll return a placeholder
    res.status(200).json({
      status: 'success',
      data: {
        activity: [
          {
            type: 'login',
            timestamp: user.lastLogin || user.createdAt,
            details: 'User logged in'
          },
          {
            type: 'account_created',
            timestamp: user.createdAt,
            details: 'Account created'
          }
        ]
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get permissions and roles summary
router.get('/roles', authorize('admin', 'superadmin'), (req, res) => {
  // Use RBAC service to get all roles and permissions
  const roles = rbac.getAllRoles();
  
  res.status(200).json({
    status: 'success',
    data: { roles }
  });
});

module.exports = router;