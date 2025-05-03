// js/services/api-service.js

/**
 * API Service
 * 
 * Handles all HTTP requests to the StayCrest backend API.
 * Manages authentication, error handling, and response parsing.
 */
export class ApiService {
  /**
   * Initialize the API Service
   * @param {string} baseUrl - Base URL for API requests
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl || 'http://localhost:3000/api';
    this.token = localStorage.getItem('token');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   * @param {string} refreshToken - Refresh token
   */
  setAuthTokens(token, refreshToken) {
    this.token = token;
    this.refreshToken = refreshToken;
    
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
  }

  /**
   * Clear authentication tokens
   */
  clearAuthTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  }

  /**
   * Get request headers
   * @param {boolean} includeAuth - Whether to include authentication header
   * @returns {Object} Headers object
   */
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Handle API response
   * @param {Response} response - Fetch API response
   * @returns {Promise<Object>} Parsed response data
   */
  async handleResponse(response) {
    const data = await response.json();

    if (!response.ok) {
      // Handle 401 (Unauthorized) errors
      if (response.status === 401 && this.refreshToken) {
        // Try to refresh the token
        const refreshed = await this.refreshAuthToken();
        
        if (refreshed) {
          // Retry the original request with the new token
          return this.retryRequest(response.url, response.method, response.body);
        }
      }
      
      // Throw error for other status codes
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  /**
   * Refresh authentication token
   * @returns {Promise<boolean>} Whether token refresh was successful
   */
  async refreshAuthToken() {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        this.setAuthTokens(data.token, data.refreshToken);
        return true;
      } else {
        // If refresh fails, clear tokens
        this.clearAuthTokens();
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.clearAuthTokens();
      return false;
    }
  }

  /**
   * Retry a request with the new token
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {Object} body - Request body
   * @returns {Promise<Object>} Parsed response data
   */
  async retryRequest(url, method, body) {
    const response = await fetch(url, {
      method,
      headers: this.getHeaders(),
      body,
    });

    return this.handleResponse(response);
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} queryParams - Query parameters
   * @param {boolean} auth - Whether to include authentication
   * @returns {Promise<Object>} Parsed response data
   */
  async get(endpoint, queryParams = {}, auth = true) {
    // Build query string
    const queryString = Object.keys(queryParams)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
    
    const url = `${this.baseUrl}${endpoint}${queryString ? `?${queryString}` : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(auth),
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error(`GET ${endpoint} error:`, error);
      throw error;
    }
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @param {boolean} auth - Whether to include authentication
   * @returns {Promise<Object>} Parsed response data
   */
  async post(endpoint, data = {}, auth = true) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(auth),
        body: JSON.stringify(data),
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error(`POST ${endpoint} error:`, error);
      throw error;
    }
  }

  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body data
   * @param {boolean} auth - Whether to include authentication
   * @returns {Promise<Object>} Parsed response data
   */
  async put(endpoint, data = {}, auth = true) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(auth),
        body: JSON.stringify(data),
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error(`PUT ${endpoint} error:`, error);
      throw error;
    }
  }

  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {boolean} auth - Whether to include authentication
   * @returns {Promise<Object>} Parsed response data
   */
  async delete(endpoint, auth = true) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(auth),
      });

      return this.handleResponse(response);
    } catch (error) {
      console.error(`DELETE ${endpoint} error:`, error);
      throw error;
    }
  }

  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration response
   */
  async register(userData) {
    const response = await this.post('/auth/register', userData, false);
    
    if (response.token) {
      this.setAuthTokens(response.token, response.refreshToken);
    }
    
    return response;
  }

  /**
   * Login a user
   * @param {Object} credentials - User login credentials
   * @returns {Promise<Object>} Login response
   */
  async login(credentials) {
    const response = await this.post('/auth/login', credentials, false);
    
    if (response.token) {
      this.setAuthTokens(response.token, response.refreshToken);
    }
    
    return response;
  }

  /**
   * Logout a user
   * @returns {Promise<Object>} Logout response
   */
  async logout() {
    try {
      await this.post('/auth/logout');
    } finally {
      // Always clear tokens even if the request fails
      this.clearAuthTokens();
    }
  }

  /**
   * Get current user profile
   * @returns {Promise<Object>} User profile data
   */
  async getCurrentUser() {
    return this.get('/auth/me');
  }

  /**
   * Update user profile
   * @param {Object} profileData - Updated profile data
   * @returns {Promise<Object>} Updated user profile
   */
  async updateProfile(profileData) {
    return this.put('/auth/update-details', profileData);
  }

  /**
   * Update user password
   * @param {Object} passwordData - Password update data
   * @returns {Promise<Object>} Password update response
   */
  async updatePassword(passwordData) {
    const response = await this.put('/auth/update-password', passwordData);
    
    if (response.token) {
      this.setAuthTokens(response.token, response.refreshToken);
    }
    
    return response;
  }

  /**
   * Get user's saved searches
   * @param {Object} queryParams - Query parameters
   * @returns {Promise<Object>} Saved searches
   */
  async getSavedSearches(queryParams = {}) {
    return this.get('/user/searches', { saved: true, ...queryParams });
  }

  /**
   * Save a search
   * @param {string} searchId - Search ID to save
   * @returns {Promise<Object>} Saved search
   */
  async saveSearch(searchId) {
    return this.put(`/user/searches/${searchId}/save`);
  }

  /**
   * Schedule a saved search
   * @param {string} searchId - Search ID to schedule
   * @param {Object} scheduleOptions - Schedule options
   * @returns {Promise<Object>} Scheduled search
   */
  async scheduleSearch(searchId, scheduleOptions) {
    return this.put(`/user/searches/${searchId}/schedule`, scheduleOptions);
  }

  /**
   * Delete a saved search
   * @param {string} searchId - Search ID to delete
   * @returns {Promise<Object>} Delete response
   */
  async deleteSearch(searchId) {
    return this.delete(`/user/searches/${searchId}`);
  }

  /**
   * Get user preferences
   * @returns {Promise<Object>} User preferences
   */
  async getUserPreferences() {
    return this.get('/user/preferences');
  }

  /**
   * Update user preferences
   * @param {Object} preferences - Updated preferences
   * @returns {Promise<Object>} Updated preferences
   */
  async updateUserPreferences(preferences) {
    return this.put('/user/preferences', preferences);
  }

  /**
   * Get list of loyalty programs
   * @returns {Promise<Object>} Loyalty programs list
   */
  async getLoyaltyPrograms() {
    return this.get('/loyalty/programs', {}, false);
  }

  /**
   * Get system feature flags
   * @returns {Promise<Object>} Feature flags
   */
  async getFeatureFlags() {
    return this.get('/features', {}, false);
  }

  /**
   * Add a user loyalty account
   * @param {Object} accountData - Loyalty account data
   * @returns {Promise<Object>} Added loyalty account
   */
  async addLoyaltyAccount(accountData) {
    return this.post('/user/loyalty-accounts', accountData);
  }

  /**
   * Get user loyalty accounts
   * @returns {Promise<Object>} User loyalty accounts
   */
  async getLoyaltyAccounts() {
    return this.get('/user/loyalty-accounts');
  }

  /**
   * Remove a loyalty account
   * @param {string} program - Loyalty program ID
   * @returns {Promise<Object>} Remove response
   */
  async removeLoyaltyAccount(program) {
    return this.delete(`/user/loyalty-accounts/${program}`);
  }
}