/**
 * Role-Based Access Control (RBAC) Service
 * Handles permissions and access control beyond simple role checking
 */

// Define permission sets for each role
const rolePermissions = {
  user: [
    'view_own_profile',
    'edit_own_profile',
    'view_hotel_listings',
    'make_bookings'
  ],
  moderator: [
    'view_own_profile',
    'edit_own_profile',
    'view_hotel_listings',
    'make_bookings',
    'approve_reviews',
    'edit_hotel_content'
  ],
  admin: [
    'view_own_profile',
    'edit_own_profile',
    'view_hotel_listings',
    'make_bookings',
    'approve_reviews',
    'edit_hotel_content',
    'manage_users',
    'manage_moderators',
    'access_analytics',
    'manage_settings'
  ],
  superadmin: [
    'view_own_profile',
    'edit_own_profile',
    'view_hotel_listings',
    'make_bookings',
    'approve_reviews',
    'edit_hotel_content',
    'manage_users',
    'manage_moderators',
    'manage_admins',
    'access_analytics',
    'manage_settings',
    'system_configuration'
  ]
};

/**
 * Check if a user has a specific permission
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @returns {boolean} Whether user has permission
 */
function hasPermission(user, permission) {
  if (!user || !user.role) {
    return false;
  }
  
  // Get permissions for the user's role
  const permissions = rolePermissions[user.role] || [];
  
  return permissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} Whether user has any of the permissions
 */
function hasAnyPermission(user, permissions) {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  
  return permissions.some(permission => hasPermission(user, permission));
}

/**
 * Check if a user has all of the specified permissions
 * @param {Object} user - User object
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} Whether user has all permissions
 */
function hasAllPermissions(user, permissions) {
  if (!permissions || permissions.length === 0) {
    return false;
  }
  
  return permissions.every(permission => hasPermission(user, permission));
}

/**
 * Middleware to check for specific permission
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }
    
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to access this resource'
      });
    }
    
    next();
  };
}

/**
 * Check if a user can manage another user based on roles
 * @param {Object} manager - User attempting to manage
 * @param {Object} target - User being managed
 * @returns {boolean} Whether manager can manage target
 */
function canManageUser(manager, target) {
  if (!manager || !target) {
    return false;
  }
  
  // Users can't manage themselves (for certain operations)
  if (manager.id === target.id) {
    return false;
  }
  
  // Role hierarchy
  const roleHierarchy = {
    'superadmin': 4,
    'admin': 3,
    'moderator': 2,
    'user': 1
  };
  
  const managerLevel = roleHierarchy[manager.role] || 0;
  const targetLevel = roleHierarchy[target.role] || 0;
  
  // Can only manage users with lower role level
  return managerLevel > targetLevel;
}

/**
 * Get all permissions for a given role
 * @param {string} role - Role name
 * @returns {string[]} Array of permissions
 */
function getPermissionsForRole(role) {
  return rolePermissions[role] || [];
}

/**
 * Get all roles and their permissions
 * @returns {Object} Roles and permissions
 */
function getAllRoles() {
  const roles = {};
  
  for (const [role, permissions] of Object.entries(rolePermissions)) {
    roles[role] = {
      permissions,
      description: getRoleDescription(role)
    };
  }
  
  return roles;
}

/**
 * Get description for a role
 * @param {string} role - Role name
 * @returns {string} Role description
 */
function getRoleDescription(role) {
  const descriptions = {
    'user': 'Regular user account',
    'moderator': 'Content moderator with limited administrative access',
    'admin': 'System administrator with extensive privileges',
    'superadmin': 'Super administrator with complete system control'
  };
  
  return descriptions[role] || 'Unknown role';
}

/**
 * Check if a role can be assigned by a user
 * @param {Object} user - User doing the assignment
 * @param {string} role - Role to assign
 * @returns {boolean} Whether user can assign the role
 */
function canAssignRole(user, role) {
  if (!user || !role) {
    return false;
  }
  
  // Role hierarchy
  const roleHierarchy = {
    'superadmin': 4,
    'admin': 3,
    'moderator': 2,
    'user': 1
  };
  
  const userLevel = roleHierarchy[user.role] || 0;
  const roleLevel = roleHierarchy[role] || 0;
  
  // Only superadmin can assign admin or superadmin roles
  if (role === 'admin' || role === 'superadmin') {
    return user.role === 'superadmin';
  }
  
  // Can only assign roles of lower level than yourself
  return userLevel > roleLevel;
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  requirePermission,
  canManageUser,
  getPermissionsForRole,
  getAllRoles,
  getRoleDescription,
  canAssignRole
}; 