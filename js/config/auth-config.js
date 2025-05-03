/**
 * StayCrest Authentication Configuration
 * 
 * This file contains configuration settings for authentication
 * and authorization in the StayCrest application.
 */

const AuthConfig = {
  /**
   * Auth provider configurations
   */
  providers: {
    // Local authentication (email/password)
    local: {
      enabled: true,
      loginUrl: '/api/auth/login',
      registerUrl: '/api/auth/register',
      forgotPasswordUrl: '/api/auth/forgot-password',
      resetPasswordUrl: '/api/auth/reset-password',
      verifyEmailUrl: '/api/auth/verify-email'
    },
    
    // Google OAuth
    google: {
      enabled: true,
      clientId: '', // Set from environment in production
      authUrl: '/api/auth/google',
      callbackUrl: '/api/auth/google/callback',
      scopes: ['profile', 'email'],
      icon: '/assets/images/auth/google.svg'
    },
    
    // Facebook OAuth
    facebook: {
      enabled: true,
      appId: '', // Set from environment in production
      authUrl: '/api/auth/facebook',
      callbackUrl: '/api/auth/facebook/callback',
      scopes: ['email', 'public_profile'],
      icon: '/assets/images/auth/facebook.svg'
    }
  },
  
  /**
   * Token settings
   */
  tokens: {
    // Access token (JWT)
    access: {
      storageKey: 'staycrest_access_token',
      expiresIn: '1h', // 1 hour
      refreshBeforeExpiry: 300 // Refresh if less than 5 minutes left
    },
    
    // Refresh token
    refresh: {
      storageKey: 'staycrest_refresh_token',
      expiresIn: '30d', // 30 days
      url: '/api/auth/refresh'
    }
  },
  
  /**
   * User roles and permissions
   */
  roles: {
    // Guest (not logged in)
    guest: {
      level: 0,
      permissions: [
        'view_public_content',
        'search_hotels',
        'view_loyalty_info'
      ]
    },
    
    // Standard user (logged in)
    user: {
      level: 1,
      permissions: [
        'view_public_content',
        'search_hotels',
        'view_loyalty_info',
        'manage_profile',
        'save_searches',
        'view_own_history',
        'connect_loyalty_accounts'
      ]
    },
    
    // Premium user (paid subscription)
    premium: {
      level: 2,
      permissions: [
        'view_public_content',
        'search_hotels',
        'view_loyalty_info',
        'manage_profile',
        'save_searches',
        'view_own_history',
        'connect_loyalty_accounts',
        'access_premium_features',
        'view_advanced_analytics',
        'use_ai_recommendations'
      ]
    },
    
    // Administrator
    admin: {
      level: 10,
      permissions: [
        'view_public_content',
        'search_hotels',
        'view_loyalty_info',
        'manage_profile',
        'save_searches',
        'view_own_history',
        'connect_loyalty_accounts',
        'access_premium_features',
        'view_advanced_analytics',
        'use_ai_recommendations',
        'manage_users',
        'view_all_data',
        'modify_settings',
        'view_system_logs'
      ]
    }
  },
  
  /**
   * Password policy settings
   */
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxAge: 90, // days
    preventReuse: 5 // prevent reuse of last 5 passwords
  },
  
  /**
   * Session settings
   */
  session: {
    inactivityTimeout: 30, // minutes
    absoluteTimeout: 24, // hours
    renewOnActivity: true
  },
  
  /**
   * Security settings
   */
  security: {
    enableMFA: true, // Multi-factor authentication
    mfaMethods: ['app', 'sms', 'email'], // Available MFA methods
    lockoutThreshold: 5, // Failed attempts before account lockout
    lockoutDuration: 15, // minutes
    passwordResetExpiry: 24 // hours
  }
};

export default AuthConfig; 