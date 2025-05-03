/**
 * SavedSearches Module
 * 
 * Manages user's saved searches and recent search history
 */

import ApiService from '../services/api-service.js';
import DataSources from '../config/data-sources.js';
import Analytics from '../services/analytics-service.js';
import userProfile from './user-profile.js';

class SavedSearches {
  constructor() {
    this.savedSearches = [];
    this.recentSearches = [];
    this.isInitialized = false;
    this.changeListeners = [];
    this.maxRecentSearches = 10;
  }
  
  /**
   * Initialize the saved searches module
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load saved searches if user is authenticated
      if (userProfile.isAuthenticated()) {
        await this.loadSavedSearches();
        await this.loadRecentSearches();
      }
      
      // Listen for user profile changes
      window.addEventListener('user-profile-changed', this.handleProfileChange.bind(this));
      
      this.isInitialized = true;
      console.log('Saved searches module initialized');
    } catch (error) {
      console.error('Failed to initialize saved searches:', error);
    }
  }
  
  /**
   * Handle profile changes
   */
  async handleProfileChange(event) {
    const detail = event.detail;
    
    // If user logged in, load their searches
    if (detail.event === 'user-loaded' && userProfile.isAuthenticated()) {
      await this.loadSavedSearches();
      await this.loadRecentSearches();
    }
    
    // If user logged out, clear searches
    if (detail.event === 'guest-user-set') {
      this.clearSearches();
    }
  }
  
  /**
   * Load saved searches from API
   */
  async loadSavedSearches() {
    try {
      const response = await ApiService.get(DataSources.apiEndpoints.user + '/saved-searches');
      
      if (response.success) {
        this.savedSearches = response.data.savedSearches || [];
        this.notifyChange('saved-searches-loaded');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading saved searches:', error);
      return false;
    }
  }
  
  /**
   * Load recent search history
   */
  async loadRecentSearches() {
    try {
      const response = await ApiService.get(DataSources.apiEndpoints.user + '/recent-searches');
      
      if (response.success) {
        this.recentSearches = response.data.recentSearches || [];
        this.notifyChange('recent-searches-loaded');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error loading recent searches:', error);
      return false;
    }
  }
  
  /**
   * Save a search
   */
  async saveSearch(searchData) {
    try {
      // Make sure search has a name
      if (!searchData.name) {
        searchData.name = searchData.query || 'Unnamed search';
      }
      
      const response = await ApiService.post(DataSources.apiEndpoints.user + '/saved-searches', searchData);
      
      if (response.success) {
        this.savedSearches = response.data.savedSearches;
        this.notifyChange('search-saved');
        
        // Track in analytics
        Analytics.trackEvent('search_saved', {
          userId: userProfile.getUser()?.id,
          searchName: searchData.name,
          query: searchData.query
        });
        
        return response.data.savedSearch;
      }
      
      return null;
    } catch (error) {
      console.error('Error saving search:', error);
      return null;
    }
  }
  
  /**
   * Update a saved search
   */
  async updateSavedSearch(searchId, updates) {
    try {
      const response = await ApiService.put(`${DataSources.apiEndpoints.user}/saved-searches/${searchId}`, updates);
      
      if (response.success) {
        // Update local list
        const index = this.savedSearches.findIndex(s => s.id === searchId);
        if (index !== -1) {
          this.savedSearches[index] = response.data.savedSearch;
        }
        
        this.notifyChange('search-updated');
        
        // Track in analytics
        Analytics.trackEvent('search_updated', {
          userId: userProfile.getUser()?.id,
          searchId
        });
        
        return response.data.savedSearch;
      }
      
      return null;
    } catch (error) {
      console.error('Error updating saved search:', error);
      return null;
    }
  }
  
  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId) {
    try {
      const response = await ApiService.delete(`${DataSources.apiEndpoints.user}/saved-searches/${searchId}`);
      
      if (response.success) {
        // Remove from local list
        this.savedSearches = this.savedSearches.filter(s => s.id !== searchId);
        this.notifyChange('search-deleted');
        
        // Track in analytics
        Analytics.trackEvent('search_deleted', {
          userId: userProfile.getUser()?.id,
          searchId
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error deleting saved search:', error);
      return false;
    }
  }
  
  /**
   * Track a new search (adds to recent searches)
   */
  async trackSearch(searchData) {
    try {
      // Skip tracking for guest users
      if (!userProfile.isAuthenticated()) {
        // Store in session storage for guest users
        this.storeGuestSearch(searchData);
        return null;
      }
      
      const response = await ApiService.post(`${DataSources.apiEndpoints.search}/track`, searchData);
      
      if (response.success) {
        // Update recent searches if available
        if (response.data.recentSearches) {
          this.recentSearches = response.data.recentSearches;
        } else {
          // Add to recent searches locally
          this.addToRecentSearches(searchData);
        }
        
        this.notifyChange('search-tracked');
        
        // Track in analytics
        Analytics.trackEvent('search_performed', {
          userId: userProfile.getUser()?.id,
          query: searchData.query,
          filters: searchData.filters ? Object.keys(searchData.filters) : []
        });
        
        return response.data.searchHistory;
      }
      
      return null;
    } catch (error) {
      console.error('Error tracking search:', error);
      
      // Add to recent searches locally as fallback
      this.addToRecentSearches(searchData);
      return null;
    }
  }
  
  /**
   * Add to recent searches locally
   */
  addToRecentSearches(searchData) {
    // Add timestamp if not present
    if (!searchData.timestamp) {
      searchData.timestamp = new Date();
    }
    
    // Add ID if not present
    if (!searchData.id) {
      searchData.id = `local_${Date.now()}`;
    }
    
    // Remove duplicates based on query
    this.recentSearches = this.recentSearches.filter(s => s.query !== searchData.query);
    
    // Add to start of array
    this.recentSearches.unshift(searchData);
    
    // Limit to max amount
    if (this.recentSearches.length > this.maxRecentSearches) {
      this.recentSearches = this.recentSearches.slice(0, this.maxRecentSearches);
    }
    
    this.notifyChange('recent-searches-updated');
  }
  
  /**
   * Store search for guest users in session storage
   */
  storeGuestSearch(searchData) {
    try {
      // Get existing searches from session storage
      let guestSearches = [];
      const storedSearches = sessionStorage.getItem('guest_recent_searches');
      
      if (storedSearches) {
        guestSearches = JSON.parse(storedSearches);
      }
      
      // Add timestamp if not present
      if (!searchData.timestamp) {
        searchData.timestamp = new Date().toISOString();
      }
      
      // Add ID if not present
      if (!searchData.id) {
        searchData.id = `guest_${Date.now()}`;
      }
      
      // Remove duplicates based on query
      guestSearches = guestSearches.filter(s => s.query !== searchData.query);
      
      // Add to start of array
      guestSearches.unshift(searchData);
      
      // Limit to max amount
      if (guestSearches.length > this.maxRecentSearches) {
        guestSearches = guestSearches.slice(0, this.maxRecentSearches);
      }
      
      // Save back to session storage
      sessionStorage.setItem('guest_recent_searches', JSON.stringify(guestSearches));
      
      // Update recent searches locally
      this.recentSearches = guestSearches;
      this.notifyChange('recent-searches-updated');
      
      // Track in analytics
      Analytics.trackEvent('guest_search_performed', {
        query: searchData.query,
        filters: searchData.filters ? Object.keys(searchData.filters) : []
      });
    } catch (error) {
      console.error('Error storing guest search:', error);
    }
  }
  
  /**
   * Clear all searches (used on logout)
   */
  clearSearches() {
    this.savedSearches = [];
    this.recentSearches = [];
    this.notifyChange('searches-cleared');
  }
  
  /**
   * Get all saved searches
   */
  getSavedSearches() {
    return this.savedSearches;
  }
  
  /**
   * Get recent searches
   */
  getRecentSearches() {
    return this.recentSearches;
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
        console.error('Error in saved searches change listener:', error);
      }
    });
    
    // Dispatch DOM event for component updates
    window.dispatchEvent(new CustomEvent('saved-searches-changed', {
      detail: {
        event,
        savedSearches: this.savedSearches,
        recentSearches: this.recentSearches
      }
    }));
  }
}

// Create singleton instance
const savedSearches = new SavedSearches();

export default savedSearches; 