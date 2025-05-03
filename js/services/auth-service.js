/**
 * Auth Service
 * 
 * Handles client-side authentication, authorization, and token management
 */

import ApiService from './api-service.js';
import AuthConfig from '../config/auth-config.js';
import Analytics from './analytics-service.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.tokens = {
      access: null,
      refresh: null
    };
    this.isInitialized = false;
    this.refreshPromise = null;
    this.tokenRefreshInterval = null;
    this.authStateListeners = [];
  }
  
  /**
   * Initialize the auth service
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Attempt to restore session from storage
      await this.restoreSession();
      
      // Set up token refresh mechanism
      this.setupTokenRefresh();
      
      this.isInitialized = true;
      console.log('Auth service initialized');
    } catch (error) {
      console.error('Failed to initialize auth service:', error);
      // Clear any invalid tokens
      this.clearTokens();
    }
  }
  
  /**
   * Restore user session from storage
   */
  async restoreSession() {
    // Get tokens from storage
    const accessToken = localStorage.getItem(AuthConfig.tokens.access.storageKey);
    const refreshToken = localStorage.getItem(AuthConfig.tokens.refresh.storageKey);
    
    if (!accessToken || !refreshToken) {
      return false;
    }
    
    try {
      // Set tokens in service
      this.tokens = {
        access: accessToken,
        refresh: refreshToken
      };
      
      // Set token in API service
      ApiService.setToken(accessToken);
      
      // Verify token by fetching user info
      const userInfo = await this.fetchUserInfo();
      
      if (userInfo) {
        this.currentUser = userInfo;
        this.notifyAuthChange(true);
        return true;
      } else {
        // Token invalid, try refreshing
        return await this.refreshToken();
      }
    } catch (error) {
      console.error('Error restoring session:', error);
      this.clearTokens();
      return false;
    }
  }
  
  /**
   * Fetch current user info
   */
  async fetchUserInfo() {
    try {
      const response = await ApiService.get('/api/auth/me');
      
      if (response.success) {
        return response.data.user;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user info:', error);
      return null;
    }
  }
  
  /**
   * Login with email and password
   */
  async login(email, password) {
    try {
      const response = await ApiService.post('/api/auth/login', { email, password });
      
      if (response.success) {
        // Store tokens
        this.setTokens(response.data.tokens.access, response.data.tokens.refresh);
        
        // Store user info
        this.currentUser = response.data.user;
        
        // Start token refresh interval
        this.setupTokenRefresh();
        
        // Notify auth state change
        this.notifyAuthChange(true);
        
        // Track login in analytics
        Analytics.trackEvent('auth_login', {
          method: 'email_password',
          userId: this.currentUser.id
        });
        
        return {
          success: true,
          user: this.currentUser
        };
      } else {
        return {
          success: false,
          error: response.error || 'Login failed'
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }
  
  /**
   * Register a new user
   */
  async register(userData) {
    try {
      const response = await ApiService.post('/api/auth/register', userData);
      
      if (response.success) {
        // If auto-login after registration
        if (response.data.tokens) {
          // Store tokens
          this.setTokens(response.data.tokens.access, response.data.tokens.refresh);
          
          // Store user info
          this.currentUser = response.data.user;
          
          // Start token refresh interval
          this.setupTokenRefresh();
          
          // Notify auth state change
          this.notifyAuthChange(true);
        }
        
        // Track registration in analytics
        Analytics.trackEvent('auth_register', {
          autoLogin: !!response.data.tokens
        });
        
        return {
          success: true,
          user: response.data.user,
          requiresVerification: !!response.data.requiresVerification
        };
      } else {
        return {
          success: false,
          error: response.error || 'Registration failed'
        };
      }
    } catch (error) {
      console.error('Registration error:', error);
      
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }
  
  /**
   * Login with social provider (Google, Facebook, etc.)
   */
  loginWithProvider(provider) {
    if (!AuthConfig.providers[provider] || !AuthConfig.providers[provider].enabled) {
      console.error(`Provider ${provider} not available`);
      return false;
    }
    
    // Track social login attempt
    Analytics.trackEvent('auth_social_login_start', {
      provider
    });
    
    // Get provider URL
    const providerUrl = AuthConfig.providers[provider].authUrl;
    
    // Store current URL to redirect back after auth
    sessionStorage.setItem('auth_redirect', window.location.pathname);
    
    // Redirect to provider auth URL
    window.location.href = providerUrl;
    return true;
  }
  
  /**
   * Logout current user
   */
  async logout() {
    try {
      // Call logout API to invalidate tokens on server
      await ApiService.post('/api/auth/logout');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Clear tokens and user data regardless of server response
      this.clearTokens();
      this.currentUser = null;
      
      // Clear token refresh interval
      if (this.tokenRefreshInterval) {
        clearInterval(this.tokenRefreshInterval);
        this.tokenRefreshInterval = null;
      }
      
      // Notify auth state change
      this.notifyAuthChange(false);
      
      // Track logout in analytics
      Analytics.trackEvent('auth_logout');
    }
    
    return true;
  }
  
  /**
   * Refresh the access token
   */
  async refreshToken() {
    // If already refreshing, return the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    // Create new refresh promise
    this.refreshPromise = new Promise(async (resolve, reject) => {
      try {
        if (!this.tokens.refresh) {
          reject(new Error('No refresh token available'));
          return;
        }
        
        const response = await ApiService.post('/api/auth/refresh', {
          refreshToken: this.tokens.refresh
        });
        
        if (response.success) {
          // Update tokens
          this.setTokens(response.data.tokens.access, response.data.tokens.refresh);
          
          // Update user info if provided
          if (response.data.user) {
            this.currentUser = response.data.user;
          }
          
          resolve(true);
        } else {
          // If refresh fails, clear tokens and user data
          this.clearTokens();
          this.currentUser = null;
          this.notifyAuthChange(false);
          
          reject(new Error('Token refresh failed'));
        }
      } catch (error) {
        console.error('Error refreshing token:', error);
        
        // If refresh fails, clear tokens and user data
        this.clearTokens();
        this.currentUser = null;
        this.notifyAuthChange(false);
        
        reject(error);
      } finally {
        // Clear refresh promise
        this.refreshPromise = null;
      }
    });
    
    return this.refreshPromise;
  }
  
  /**
   * Set up automatic token refresh
   */
  setupTokenRefresh() {
    // Clear existing interval if any
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }
    
    // Set up refresh interval (check every minute)
    this.tokenRefreshInterval = setInterval(() => {
      this.checkTokenExpiration();
    }, 60000);
  }
  
  /**
   * Check token expiration and refresh if needed
   */
  checkTokenExpiration() {
    if (!this.tokens.access) return;
    
    try {
      // Parse token to get expiration
      const tokenParts = this.tokens.access.split('.');
      if (tokenParts.length !== 3) return;
      
      const payload = JSON.parse(atob(tokenParts[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeLeft = expiresAt - now;
      
      // If less than the threshold, refresh token
      if (timeLeft < AuthConfig.tokens.access.refreshBeforeExpiry * 1000) {
        this.refreshToken().catch(err => {
          console.error('Automatic token refresh failed:', err);
        });
      }
    } catch (error) {
      console.error('Error checking token expiration:', error);
    }
  }
  
  /**
   * Store authentication tokens
   */
  setTokens(accessToken, refreshToken) {
    this.tokens = {
      access: accessToken,
      refresh: refreshToken
    };
    
    // Store tokens in local storage
    localStorage.setItem(AuthConfig.tokens.access.storageKey, accessToken);
    localStorage.setItem(AuthConfig.tokens.refresh.storageKey, refreshToken);
    
    // Set access token in API service
    ApiService.setToken(accessToken);
  }
  
  /**
   * Clear authentication tokens
   */
  clearTokens() {
    this.tokens = {
      access: null,
      refresh: null
    };
    
    // Remove tokens from local storage
    localStorage.removeItem(AuthConfig.tokens.access.storageKey);
    localStorage.removeItem(AuthConfig.tokens.refresh.storageKey);
    
    // Clear token in API service
    ApiService.clearToken();
  }
  
  /**
   * Send password reset email
   */
  async forgotPassword(email) {
    try {
      const response = await ApiService.post('/api/auth/forgot-password', { email });
      
      return {
        success: response.success,
        message: response.message || 'Password reset email sent'
      };
    } catch (error) {
      console.error('Error sending password reset:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to send password reset email'
      };
    }
  }
  
  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    try {
      const response = await ApiService.post('/api/auth/reset-password', {
        token,
        password: newPassword
      });
      
      return {
        success: response.success,
        message: response.message || 'Password reset successful'
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      
      return {
        success: false,
        error: error.message || 'Failed to reset password'
      };
    }
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser && !!this.tokens.access;
  }
  
  /**
   * Get current user
   */
  getUser() {
    return this.currentUser;
  }
  
  /**
   * Get user's roles and permissions
   */
  getUserPermissions() {
    if (!this.currentUser) return [];
    
    const role = this.currentUser.role || 'guest';
    return AuthConfig.roles[role]?.permissions || [];
  }
  
  /**
   * Check if user has a specific permission
   */
  hasPermission(permission) {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission);
  }
  
  /**
   * Add auth state change listener
   */
  addAuthStateListener(callback) {
    this.authStateListeners.push(callback);
    
    // Immediately call with current state
    if (this.isInitialized) {
      callback(this.isAuthenticated());
    }
    
    // Return unsubscribe function
    return () => this.removeAuthStateListener(callback);
  }
  
  /**
   * Remove auth state change listener
   */
  removeAuthStateListener(callback) {
    this.authStateListeners = this.authStateListeners.filter(cb => cb !== callback);
  }
  
  /**
   * Notify all listeners of auth state change
   */
  notifyAuthChange(isAuthenticated) {
    this.authStateListeners.forEach(listener => {
      try {
        listener(isAuthenticated);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
    
    // Dispatch DOM event for components
    window.dispatchEvent(new CustomEvent('auth-state-changed', {
      detail: {
        loggedIn: isAuthenticated,
        user: this.currentUser
      }
    }));
  }
}

// Create singleton instance
const authService = new AuthService();

export default authService; 