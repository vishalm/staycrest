/**
 * UserProfile Module
 * 
 * Handles user profile management, preferences, and loyalty account linking.
 */

import AuthConfig from '../config/auth-config.js';
import DataSources from '../config/data-sources.js';
import ApiService from '../services/api-service.js';
import Analytics from '../services/analytics-service.js';

class UserProfile {
  constructor() {
    this.currentUser = null;
    this.preferences = null;
    this.loyaltyAccounts = [];
    this.isInitialized = false;
    this.changeListeners = [];
  }
  
  /**
   * Initialize the user profile module
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Try to load user from session/token
      await this.loadCurrentUser();
      
      // Listen for auth state changes
      window.addEventListener('auth-state-changed', this.handleAuthChange.bind(this));
      
      this.isInitialized = true;
      console.log('User profile module initialized');
    } catch (error) {
      console.error('Failed to initialize user profile:', error);
      // Continue as guest user
      this.setGuestUser();
    }
  }
  
  /**
   * Load the current authenticated user
   */
  async loadCurrentUser() {
    try {
      const response = await ApiService.get(DataSources.apiEndpoints.user + '/profile');
      
      if (response.success) {
        this.currentUser = response.data.user;
        this.preferences = response.data.preferences;
        this.loyaltyAccounts = response.data.loyaltyAccounts || [];
        this.notifyChange('user-loaded');
        
        // Track user login in analytics
        Analytics.trackEvent('user_profile_loaded', {
          userId: this.currentUser.id,
          hasLoyaltyAccounts: this.loyaltyAccounts.length > 0
        });
        
        return true;
      } else {
        this.setGuestUser();
        return false;
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.setGuestUser();
      return false;
    }
  }
  
  /**
   * Set up guest user
   */
  setGuestUser() {
    this.currentUser = {
      id: null,
      role: 'guest',
      isGuest: true
    };
    
    this.preferences = {
      theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      language: navigator.language.split('-')[0] || 'en'
    };
    
    this.loyaltyAccounts = [];
    this.notifyChange('guest-user-set');
  }
  
  /**
   * Handle authentication state changes
   */
  async handleAuthChange(event) {
    const authState = event.detail;
    
    if (authState.loggedIn) {
      await this.loadCurrentUser();
    } else {
      this.setGuestUser();
    }
  }
  
  /**
   * Check if the user has a specific permission
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    const userRole = this.currentUser.role || 'guest';
    const roleConfig = AuthConfig.roles[userRole];
    
    if (!roleConfig) return false;
    
    return roleConfig.permissions.includes(permission);
  }
  
  /**
   * Get all user permissions
   */
  getAllPermissions() {
    if (!this.currentUser) return [];
    
    const userRole = this.currentUser.role || 'guest';
    const roleConfig = AuthConfig.roles[userRole];
    
    if (!roleConfig) return [];
    
    return roleConfig.permissions;
  }
  
  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    try {
      const response = await ApiService.put(DataSources.apiEndpoints.user + '/profile', profileData);
      
      if (response.success) {
        this.currentUser = {
          ...this.currentUser,
          ...response.data.user
        };
        
        this.notifyChange('profile-updated');
        
        // Track profile update in analytics
        Analytics.trackEvent('user_profile_updated', {
          userId: this.currentUser.id,
          fields: Object.keys(profileData)
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  }
  
  /**
   * Update user preferences
   */
  async updatePreferences(preferencesData) {
    try {
      const response = await ApiService.put(DataSources.apiEndpoints.user + '/preferences', preferencesData);
      
      if (response.success) {
        this.preferences = {
          ...this.preferences,
          ...response.data.preferences
        };
        
        this.notifyChange('preferences-updated');
        
        // Apply UI preferences immediately
        this.applyUIPreferences();
        
        // Track preferences update in analytics
        Analytics.trackEvent('user_preferences_updated', {
          userId: this.currentUser.id,
          preferences: Object.keys(preferencesData)
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return false;
    }
  }
  
  /**
   * Apply UI preferences (theme, language, etc)
   */
  applyUIPreferences() {
    if (!this.preferences) return;
    
    // Apply theme
    if (this.preferences.theme) {
      document.documentElement.setAttribute('data-theme', this.preferences.theme);
      
      if (this.preferences.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    
    // Apply font size
    if (this.preferences.fontSize) {
      document.documentElement.setAttribute('data-font-size', this.preferences.fontSize);
    }
    
    // Apply language
    if (this.preferences.language) {
      document.documentElement.setAttribute('lang', this.preferences.language);
    }
  }
  
  /**
   * Link a loyalty program account
   */
  async linkLoyaltyAccount(program) {
    try {
      const response = await ApiService.post(DataSources.apiEndpoints.user + '/loyalty-accounts', program);
      
      if (response.success) {
        this.loyaltyAccounts = response.data.loyaltyAccounts;
        this.notifyChange('loyalty-account-linked');
        
        // Track loyalty account linking in analytics
        Analytics.trackEvent('loyalty_account_linked', {
          userId: this.currentUser.id,
          program: program.programId
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error linking loyalty account:', error);
      return false;
    }
  }
  
  /**
   * Get loyalty account by program ID
   */
  getLoyaltyAccount(programId) {
    return this.loyaltyAccounts.find(account => account.programId === programId);
  }
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.currentUser && !this.currentUser.isGuest;
  }
  
  /**
   * Get the current user
   */
  getUser() {
    return this.currentUser;
  }
  
  /**
   * Get user preferences
   */
  getPreferences() {
    return this.preferences;
  }
  
  /**
   * Add change listener
   */
  addChangeListener(callback) {
    this.changeListeners.push(callback);
    return () => this.removeChangeListener(callback);
  }
  
  /**
   * Remove change listener
   */
  removeChangeListener(callback) {
    this.changeListeners = this.changeListeners.filter(cb => cb !== callback);
  }
  
  /**
   * Notify all listeners of changes
   */
  notifyChange(event) {
    this.changeListeners.forEach(listener => {
      try {
        listener(event, this);
      } catch (error) {
        console.error('Error in profile change listener:', error);
      }
    });
    
    // Dispatch DOM event for component updates
    window.dispatchEvent(new CustomEvent('user-profile-changed', {
      detail: {
        event,
        user: this.currentUser,
        preferences: this.preferences
      }
    }));
  }
}

// Create singleton instance
const userProfile = new UserProfile();

export default userProfile; 