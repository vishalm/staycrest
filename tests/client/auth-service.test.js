/**
 * Client-Side Auth Service Tests
 */
import authService from '../../js/services/auth-service';
import ApiService from '../../js/services/api-service';
import Analytics from '../../js/services/analytics-service';
import AuthConfig from '../../js/config/auth-config';

// Mock dependencies
jest.mock('../../js/services/api-service');
jest.mock('../../js/services/analytics-service');

describe('Auth Service', () => {
  // Set up mocks
  let localStorageMock;
  let mockDispatchEvent;
  
  beforeEach(() => {
    // Reset module state
    authService.currentUser = null;
    authService.tokens = {
      access: null,
      refresh: null
    };
    authService.isInitialized = false;
    authService.refreshPromise = null;
    authService.authStateListeners = [];
    
    if (authService.tokenRefreshInterval) {
      clearInterval(authService.tokenRefreshInterval);
      authService.tokenRefreshInterval = null;
    }
    
    // Mock localStorage
    localStorageMock = {
      store: {},
      getItem: jest.fn(key => this.store[key] || null),
      setItem: jest.fn((key, value) => {
        this.store[key] = value;
      }),
      removeItem: jest.fn(key => {
        delete this.store[key];
      }),
      clear: jest.fn(() => {
        this.store = {};
      })
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
    
    // Mock window event dispatch
    mockDispatchEvent = jest.spyOn(window, 'dispatchEvent');
    
    // Mock ApiService methods
    ApiService.setToken = jest.fn();
    ApiService.clearToken = jest.fn();
    ApiService.get.mockReset();
    ApiService.post.mockReset();
    
    // Mock Analytics methods
    Analytics.trackEvent.mockReset();
    
    // Save original methods
    authService._originalSetTokens = authService.setTokens;
    authService._originalClearTokens = authService.clearTokens;
    
    // Mock token methods
    authService.setTokens = jest.fn(authService._originalSetTokens);
    authService.clearTokens = jest.fn(authService._originalClearTokens);
  });
  
  afterEach(() => {
    mockDispatchEvent.mockRestore();
    
    // Restore original methods
    if (authService._originalSetTokens) {
      authService.setTokens = authService._originalSetTokens;
      delete authService._originalSetTokens;
    }
    
    if (authService._originalClearTokens) {
      authService.clearTokens = authService._originalClearTokens;
      delete authService._originalClearTokens;
    }
  });
  
  describe('Initialization', () => {
    it('should initialize and restore session', async () => {
      // Mock token storage
      const accessToken = 'mock-access-token';
      const refreshToken = 'mock-refresh-token';
      
      // Mock localStorage.getItem
      jest.spyOn(localStorage, 'getItem')
        .mockImplementation(key => {
          if (key === AuthConfig.tokens.access.storageKey) return accessToken;
          if (key === AuthConfig.tokens.refresh.storageKey) return refreshToken;
          return null;
        });
      
      // Mock user info response
      const mockUser = {
        id: 'user-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'user'
      };
      
      ApiService.get.mockResolvedValueOnce({
        success: true,
        data: {
          user: mockUser
        }
      });
      
      // Mock token refresh setup
      jest.spyOn(authService, 'setupTokenRefresh').mockImplementation();
      
      // Initialize
      await authService.initialize();
      
      // Check initialized state
      expect(authService.isInitialized).toBe(true);
      expect(authService.tokens.access).toBe(accessToken);
      expect(authService.tokens.refresh).toBe(refreshToken);
      expect(authService.currentUser).toEqual(mockUser);
      
      // Check API token was set
      expect(ApiService.setToken).toHaveBeenCalledWith(accessToken);
      
      // Check token refresh was set up
      expect(authService.setupTokenRefresh).toHaveBeenCalled();
      
      // Check auth state notification
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth-state-changed',
          detail: expect.objectContaining({
            loggedIn: true,
            user: mockUser
          })
        })
      );
    });
    
    it('should handle failed session restoration', async () => {
      // Mock token storage
      const accessToken = 'mock-access-token';
      const refreshToken = 'mock-refresh-token';
      
      // Mock localStorage.getItem
      jest.spyOn(localStorage, 'getItem')
        .mockImplementation(key => {
          if (key === AuthConfig.tokens.access.storageKey) return accessToken;
          if (key === AuthConfig.tokens.refresh.storageKey) return refreshToken;
          return null;
        });
      
      // Mock user info response - failed
      ApiService.get.mockRejectedValueOnce(new Error('API error'));
      
      // Mock refreshToken - also failed
      jest.spyOn(authService, 'refreshToken')
        .mockRejectedValueOnce(new Error('Refresh failed'));
      
      // Initialize
      await authService.initialize();
      
      // Check initialized state
      expect(authService.isInitialized).toBe(true);
      expect(authService.tokens.access).toBeNull();
      expect(authService.tokens.refresh).toBeNull();
      expect(authService.currentUser).toBeNull();
      
      // Check tokens were cleared
      expect(authService.clearTokens).toHaveBeenCalled();
    });
  });
  
  describe('Authentication', () => {
    beforeEach(() => {
      authService.isInitialized = true;
    });
    
    it('should login user with valid credentials', async () => {
      // Mock credentials
      const email = 'test@example.com';
      const password = 'password123';
      
      // Mock API response
      const mockUser = {
        id: 'user-id',
        firstName: 'Test',
        lastName: 'User',
        email
      };
      
      const mockTokens = {
        access: 'access-token',
        refresh: 'refresh-token'
      };
      
      ApiService.post.mockResolvedValueOnce({
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens
        }
      });
      
      // Call login
      const result = await authService.login(email, password);
      
      // Check result
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      
      // Check tokens were set
      expect(authService.setTokens).toHaveBeenCalledWith(
        mockTokens.access,
        mockTokens.refresh
      );
      
      // Check user was stored
      expect(authService.currentUser).toEqual(mockUser);
      
      // Check token refresh was set up
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth-state-changed',
          detail: expect.objectContaining({
            loggedIn: true,
            user: mockUser
          })
        })
      );
      
      // Check event was tracked
      expect(Analytics.trackEvent).toHaveBeenCalledWith(
        'auth_login',
        expect.objectContaining({
          method: 'email_password',
          userId: mockUser.id
        })
      );
    });
    
    it('should handle failed login', async () => {
      // Mock credentials
      const email = 'test@example.com';
      const password = 'wrong-password';
      
      // Mock API response - failed
      ApiService.post.mockResolvedValueOnce({
        success: false,
        error: 'Invalid credentials'
      });
      
      // Call login
      const result = await authService.login(email, password);
      
      // Check result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      
      // Check tokens were not set
      expect(authService.setTokens).not.toHaveBeenCalled();
      
      // Check user was not stored
      expect(authService.currentUser).toBeNull();
      
      // Check no auth state notification
      expect(mockDispatchEvent).not.toHaveBeenCalled();
    });
    
    it('should logout user', async () => {
      // Setup authed state
      authService.currentUser = { id: 'user-id' };
      authService.tokens = {
        access: 'access-token',
        refresh: 'refresh-token'
      };
      authService.tokenRefreshInterval = setInterval(() => {}, 1000);
      
      // Mock API response
      ApiService.post.mockResolvedValueOnce({
        success: true
      });
      
      // Call logout
      const result = await authService.logout();
      
      // Check result
      expect(result).toBe(true);
      
      // Check logout API was called
      expect(ApiService.post).toHaveBeenCalledWith('/api/auth/logout');
      
      // Check tokens were cleared
      expect(authService.clearTokens).toHaveBeenCalled();
      
      // Check user was cleared
      expect(authService.currentUser).toBeNull();
      
      // Check interval was cleared
      expect(authService.tokenRefreshInterval).toBeNull();
      
      // Check auth state notification
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth-state-changed',
          detail: expect.objectContaining({
            loggedIn: false
          })
        })
      );
      
      // Check event was tracked
      expect(Analytics.trackEvent).toHaveBeenCalledWith('auth_logout');
    });
    
    it('should refresh token', async () => {
      // Setup refresh token
      authService.tokens = {
        access: 'expired-token',
        refresh: 'refresh-token'
      };
      
      // Mock API response
      const newTokens = {
        access: 'new-access-token',
        refresh: 'new-refresh-token'
      };
      
      ApiService.post.mockResolvedValueOnce({
        success: true,
        data: {
          tokens: newTokens
        }
      });
      
      // Call refresh
      const result = await authService.refreshToken();
      
      // Check result
      expect(result).toBe(true);
      
      // Check refresh API was called
      expect(ApiService.post).toHaveBeenCalledWith(
        '/api/auth/refresh',
        { refreshToken: 'refresh-token' }
      );
      
      // Check tokens were updated
      expect(authService.setTokens).toHaveBeenCalledWith(
        newTokens.access,
        newTokens.refresh
      );
    });
    
    it('should handle failed token refresh', async () => {
      // Setup refresh token
      authService.tokens = {
        access: 'expired-token',
        refresh: 'invalid-refresh-token'
      };
      
      // Mock API response - failed
      ApiService.post.mockResolvedValueOnce({
        success: false,
        error: 'Invalid refresh token'
      });
      
      // Call refresh
      let error;
      try {
        await authService.refreshToken();
      } catch (err) {
        error = err;
      }
      
      // Check error
      expect(error).toBeDefined();
      
      // Check tokens were cleared
      expect(authService.clearTokens).toHaveBeenCalled();
      
      // Check user was cleared
      expect(authService.currentUser).toBeNull();
      
      // Check auth state notification
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth-state-changed',
          detail: expect.objectContaining({
            loggedIn: false
          })
        })
      );
    });
  });
  
  describe('Auth State', () => {
    it('should check if user is authenticated', () => {
      // Not authenticated
      expect(authService.isAuthenticated()).toBe(false);
      
      // Set authenticated state
      authService.currentUser = { id: 'user-id' };
      authService.tokens = {
        access: 'access-token',
        refresh: 'refresh-token'
      };
      
      // Authenticated
      expect(authService.isAuthenticated()).toBe(true);
      
      // Missing token
      authService.tokens.access = null;
      expect(authService.isAuthenticated()).toBe(false);
      
      // Missing user
      authService.tokens.access = 'access-token';
      authService.currentUser = null;
      expect(authService.isAuthenticated()).toBe(false);
    });
    
    it('should get user permissions', () => {
      // No user
      expect(authService.getUserPermissions()).toEqual([]);
      
      // With user role
      authService.currentUser = { role: 'user' };
      const userPermissions = authService.getUserPermissions();
      expect(userPermissions).toEqual(AuthConfig.roles.user.permissions);
      
      // Admin role
      authService.currentUser.role = 'admin';
      const adminPermissions = authService.getUserPermissions();
      expect(adminPermissions).toEqual(AuthConfig.roles.admin.permissions);
    });
    
    it('should check specific permission', () => {
      // User role
      authService.currentUser = { role: 'user' };
      
      // Should have user permissions
      expect(authService.hasPermission('view_own_history')).toBe(true);
      expect(authService.hasPermission('save_searches')).toBe(true);
      
      // Should not have admin permissions
      expect(authService.hasPermission('manage_users')).toBe(false);
      
      // Admin role
      authService.currentUser.role = 'admin';
      
      // Should have admin permissions
      expect(authService.hasPermission('manage_users')).toBe(true);
    });
    
    it('should notify auth state listeners', () => {
      // Set up mock listeners
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      // Add listeners
      authService.addAuthStateListener(listener1);
      authService.addAuthStateListener(listener2);
      
      // Set up user
      const mockUser = { id: 'user-id' };
      authService.currentUser = mockUser;
      
      // Notify state change
      authService.notifyAuthChange(true);
      
      // Check listeners were called
      expect(listener1).toHaveBeenCalledWith(true);
      expect(listener2).toHaveBeenCalledWith(true);
      
      // Check DOM event was dispatched
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth-state-changed',
          detail: expect.objectContaining({
            loggedIn: true,
            user: mockUser
          })
        })
      );
      
      // Remove a listener
      authService.removeAuthStateListener(listener1);
      
      // Reset mocks
      listener1.mockReset();
      listener2.mockReset();
      mockDispatchEvent.mockReset();
      
      // Notify again
      authService.notifyAuthChange(false);
      
      // Check only listener2 was called
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledWith(false);
      
      // Check DOM event
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'auth-state-changed',
          detail: expect.objectContaining({
            loggedIn: false
          })
        })
      );
    });
  });
}); 