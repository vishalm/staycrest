/**
 * Client-Side User Profile Module Tests
 */
import userProfile from '../../js/modules/user-profile';
import ApiService from '../../js/services/api-service';
import Analytics from '../../js/services/analytics-service';

// Mock dependencies
jest.mock('../../js/services/api-service');
jest.mock('../../js/services/analytics-service');

describe('User Profile Module', () => {
  // Set up mocks and spies
  let mockMatchMedia;
  let mockAddEventListener;
  let mockDispatchEvent;
  
  beforeEach(() => {
    // Reset module state
    userProfile.currentUser = null;
    userProfile.preferences = null;
    userProfile.loyaltyAccounts = [];
    userProfile.isInitialized = false;
    userProfile.changeListeners = [];
    
    // Mock window.matchMedia
    mockMatchMedia = jest.fn().mockReturnValue({
      matches: false
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });
    
    // Mock window event handling
    mockAddEventListener = jest.spyOn(window, 'addEventListener');
    mockDispatchEvent = jest.spyOn(window, 'dispatchEvent');
    
    // Mock ApiService methods
    ApiService.get.mockReset();
    ApiService.put.mockReset();
    ApiService.post.mockReset();
    
    // Mock Analytics methods
    Analytics.trackEvent.mockReset();
  });
  
  afterEach(() => {
    // Clean up mocks
    mockAddEventListener.mockRestore();
    mockDispatchEvent.mockRestore();
  });
  
  describe('Initialization', () => {
    it('should initialize and load user data on success', async () => {
      // Mock successful API response
      const mockUser = {
        id: 'test-user-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'user'
      };
      
      const mockPreferences = {
        theme: 'dark',
        language: 'en'
      };
      
      const mockLoyaltyAccounts = [
        {
          programId: 'marriott-bonvoy',
          membershipId: 'MB123456',
          tier: 'Gold'
        }
      ];
      
      ApiService.get.mockResolvedValueOnce({
        success: true,
        data: {
          user: mockUser,
          preferences: mockPreferences,
          loyaltyAccounts: mockLoyaltyAccounts
        }
      });
      
      // Initialize the module
      await userProfile.initialize();
      
      // Check that user data was loaded
      expect(userProfile.isInitialized).toBe(true);
      expect(userProfile.currentUser).toEqual(mockUser);
      expect(userProfile.preferences).toEqual(mockPreferences);
      expect(userProfile.loyaltyAccounts).toEqual(mockLoyaltyAccounts);
      
      // Check that event listener was added
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'auth-state-changed',
        expect.any(Function)
      );
      
      // Check that change notification was sent
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-profile-changed'
        })
      );
      
      // Check that event was tracked
      expect(Analytics.trackEvent).toHaveBeenCalledWith(
        'user_profile_loaded',
        expect.objectContaining({
          userId: mockUser.id,
          hasLoyaltyAccounts: true
        })
      );
    });
    
    it('should set up guest user on API failure', async () => {
      // Mock API failure
      ApiService.get.mockRejectedValueOnce(new Error('API failure'));
      
      // Initialize the module
      await userProfile.initialize();
      
      // Check that guest user was set up
      expect(userProfile.isInitialized).toBe(true);
      expect(userProfile.currentUser).toBeDefined();
      expect(userProfile.currentUser.role).toBe('guest');
      expect(userProfile.currentUser.isGuest).toBe(true);
      
      // Check that event listener was added
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'auth-state-changed',
        expect.any(Function)
      );
      
      // Check that change notification was sent
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-profile-changed'
        })
      );
    });
  });
  
  describe('User Operations', () => {
    beforeEach(async () => {
      // Set up initialized state with a user
      userProfile.currentUser = {
        id: 'test-user-id',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        role: 'user'
      };
      
      userProfile.preferences = {
        theme: 'light',
        language: 'en'
      };
      
      userProfile.isInitialized = true;
    });
    
    it('should update user profile', async () => {
      // Set up update data
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };
      
      // Mock successful API response
      ApiService.put.mockResolvedValueOnce({
        success: true,
        data: {
          user: {
            ...userProfile.currentUser,
            ...updateData
          }
        }
      });
      
      // Call update method
      const result = await userProfile.updateProfile(updateData);
      
      // Check result
      expect(result).toBe(true);
      
      // Check that user data was updated
      expect(userProfile.currentUser.firstName).toBe(updateData.firstName);
      expect(userProfile.currentUser.lastName).toBe(updateData.lastName);
      
      // Check that API was called correctly
      expect(ApiService.put).toHaveBeenCalledWith(
        expect.stringContaining('/profile'),
        updateData
      );
      
      // Check that change notification was sent
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-profile-changed',
          detail: expect.objectContaining({
            event: 'profile-updated'
          })
        })
      );
      
      // Check that event was tracked
      expect(Analytics.trackEvent).toHaveBeenCalledWith(
        'user_profile_updated',
        expect.objectContaining({
          userId: userProfile.currentUser.id,
          fields: ['firstName', 'lastName']
        })
      );
    });
    
    it('should update user preferences', async () => {
      // Set up update data
      const preferencesData = {
        theme: 'dark',
        fontSize: 'large'
      };
      
      // Mock DOM methods
      document.documentElement.setAttribute = jest.fn();
      document.documentElement.classList.add = jest.fn();
      document.documentElement.classList.remove = jest.fn();
      
      // Mock successful API response
      ApiService.put.mockResolvedValueOnce({
        success: true,
        data: {
          preferences: {
            ...userProfile.preferences,
            ...preferencesData
          }
        }
      });
      
      // Call update method
      const result = await userProfile.updatePreferences(preferencesData);
      
      // Check result
      expect(result).toBe(true);
      
      // Check that preferences were updated
      expect(userProfile.preferences.theme).toBe(preferencesData.theme);
      expect(userProfile.preferences.fontSize).toBe(preferencesData.fontSize);
      
      // Check that API was called correctly
      expect(ApiService.put).toHaveBeenCalledWith(
        expect.stringContaining('/preferences'),
        preferencesData
      );
      
      // Check that UI preferences were applied
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-theme',
        preferencesData.theme
      );
      
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
        'data-font-size',
        preferencesData.fontSize
      );
      
      // Check dark theme handling
      expect(document.documentElement.classList.add).toHaveBeenCalledWith('dark');
      
      // Check that change notification was sent
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-profile-changed',
          detail: expect.objectContaining({
            event: 'preferences-updated'
          })
        })
      );
      
      // Check that event was tracked
      expect(Analytics.trackEvent).toHaveBeenCalledWith(
        'user_preferences_updated',
        expect.objectContaining({
          userId: userProfile.currentUser.id,
          preferences: ['theme', 'fontSize']
        })
      );
    });
    
    it('should link a loyalty account', async () => {
      // Set up loyalty program data
      const programData = {
        programId: 'marriott-bonvoy',
        membershipId: 'MB123456',
        tier: 'Gold'
      };
      
      // Mock successful API response
      ApiService.post.mockResolvedValueOnce({
        success: true,
        data: {
          loyaltyAccounts: [programData]
        }
      });
      
      // Call link method
      const result = await userProfile.linkLoyaltyAccount(programData);
      
      // Check result
      expect(result).toBe(true);
      
      // Check that loyalty accounts were updated
      expect(userProfile.loyaltyAccounts).toHaveLength(1);
      expect(userProfile.loyaltyAccounts[0]).toEqual(programData);
      
      // Check that API was called correctly
      expect(ApiService.post).toHaveBeenCalledWith(
        expect.stringContaining('/loyalty-accounts'),
        programData
      );
      
      // Check that change notification was sent
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user-profile-changed',
          detail: expect.objectContaining({
            event: 'loyalty-account-linked'
          })
        })
      );
      
      // Check that event was tracked
      expect(Analytics.trackEvent).toHaveBeenCalledWith(
        'loyalty_account_linked',
        expect.objectContaining({
          userId: userProfile.currentUser.id,
          program: programData.programId
        })
      );
    });
    
    it('should check if user is authenticated', () => {
      // Regular user
      expect(userProfile.isAuthenticated()).toBe(true);
      
      // Guest user
      userProfile.currentUser.isGuest = true;
      expect(userProfile.isAuthenticated()).toBe(false);
      
      // No user
      userProfile.currentUser = null;
      expect(userProfile.isAuthenticated()).toBe(false);
    });
    
    it('should handle auth state changes', async () => {
      // Set up spy on loadCurrentUser
      const loadSpy = jest.spyOn(userProfile, 'loadCurrentUser').mockResolvedValue(true);
      const guestSpy = jest.spyOn(userProfile, 'setGuestUser');
      
      // Test login event
      await userProfile.handleAuthChange({
        detail: { loggedIn: true }
      });
      
      expect(loadSpy).toHaveBeenCalled();
      expect(guestSpy).not.toHaveBeenCalled();
      
      // Reset spies
      loadSpy.mockClear();
      guestSpy.mockClear();
      
      // Test logout event
      await userProfile.handleAuthChange({
        detail: { loggedIn: false }
      });
      
      expect(loadSpy).not.toHaveBeenCalled();
      expect(guestSpy).toHaveBeenCalled();
      
      // Clean up spies
      loadSpy.mockRestore();
      guestSpy.mockRestore();
    });
  });
  
  describe('Permissions', () => {
    beforeEach(() => {
      // Set up a user with a role
      userProfile.currentUser = {
        id: 'test-user-id',
        role: 'user'
      };
    });
    
    it('should check if user has a permission', () => {
      // Should have user permissions
      expect(userProfile.hasPermission('view_own_history')).toBe(true);
      expect(userProfile.hasPermission('save_searches')).toBe(true);
      
      // Should not have admin permissions
      expect(userProfile.hasPermission('manage_users')).toBe(false);
      
      // Set admin role
      userProfile.currentUser.role = 'admin';
      
      // Should have admin permissions
      expect(userProfile.hasPermission('manage_users')).toBe(true);
      expect(userProfile.hasPermission('view_system_logs')).toBe(true);
      
      // No user case
      userProfile.currentUser = null;
      expect(userProfile.hasPermission('view_public_content')).toBe(false);
    });
    
    it('should get all user permissions', () => {
      // Get all permissions for a user
      const permissions = userProfile.getAllPermissions();
      
      // Should be an array
      expect(Array.isArray(permissions)).toBe(true);
      
      // Should contain user permissions
      expect(permissions).toContain('view_public_content');
      expect(permissions).toContain('manage_profile');
      expect(permissions).toContain('save_searches');
      
      // Should not contain admin permissions
      expect(permissions).not.toContain('manage_users');
      
      // No user case
      userProfile.currentUser = null;
      expect(userProfile.getAllPermissions()).toEqual([]);
    });
  });
}); 