/**
 * DirectNavigation Module
 * 
 * Handles URL-based routing and deep linking within the StayCrest application.
 */

import userProfile from './user-profile.js';
import savedSearches from './saved-searches.js';
import Analytics from '../services/analytics-service.js';

class DirectNavigation {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.defaultRoute = '/home';
    this.isInitialized = false;
    this.routeChangeListeners = [];
    this.isNavigating = false;
  }
  
  /**
   * Initialize the direct navigation module
   */
  initialize() {
    if (this.isInitialized) return;
    
    // Define available routes
    this.defineRoutes();
    
    // Set up event listeners
    window.addEventListener('popstate', this.handlePopState.bind(this));
    document.addEventListener('click', this.handleLinkClick.bind(this));
    
    // Handle initial route
    this.handleCurrentUrl();
    
    this.isInitialized = true;
    console.log('Direct navigation module initialized');
  }
  
  /**
   * Define available routes
   */
  defineRoutes() {
    this.routes = [
      {
        path: '/home',
        title: 'Home',
        component: 'home-view',
        requiresAuth: false
      },
      {
        path: '/search',
        title: 'Search Hotels',
        component: 'search-view',
        requiresAuth: false
      },
      {
        path: '/search/:query',
        title: 'Search Results',
        component: 'search-results-view',
        requiresAuth: false
      },
      {
        path: '/hotel/:id',
        title: 'Hotel Details',
        component: 'hotel-details-view',
        requiresAuth: false
      },
      {
        path: '/loyalty-programs',
        title: 'Loyalty Programs',
        component: 'loyalty-programs-view',
        requiresAuth: false
      },
      {
        path: '/loyalty/:program',
        title: 'Loyalty Program Details',
        component: 'loyalty-program-view',
        requiresAuth: false
      },
      {
        path: '/profile',
        title: 'User Profile',
        component: 'user-profile-view',
        requiresAuth: true
      },
      {
        path: '/saved-searches',
        title: 'Saved Searches',
        component: 'saved-searches-view',
        requiresAuth: true
      },
      {
        path: '/login',
        title: 'Login',
        component: 'login-view',
        requiresAuth: false
      },
      {
        path: '/register',
        title: 'Register',
        component: 'register-view',
        requiresAuth: false
      },
      {
        path: '/admin',
        title: 'Admin Dashboard',
        component: 'admin-view',
        requiresAuth: true,
        requiredPermission: 'manage_users'
      },
      {
        path: '/404',
        title: 'Not Found',
        component: 'not-found-view',
        requiresAuth: false
      }
    ];
  }
  
  /**
   * Handle current URL on page load
   */
  handleCurrentUrl() {
    const url = window.location.pathname;
    this.navigateTo(url, null, false);
  }
  
  /**
   * Handle popstate event (browser back/forward)
   */
  handlePopState(event) {
    const url = window.location.pathname;
    this.navigateTo(url, null, false);
  }
  
  /**
   * Handle link clicks for internal navigation
   */
  handleLinkClick(event) {
    // Find clicked link if any
    let element = event.target;
    while (element && element !== document.body) {
      if (element.tagName === 'A' && element.hasAttribute('href')) {
        const href = element.getAttribute('href');
        
        // Skip external links, downloads, etc.
        if (href.startsWith('http') || 
            href.startsWith('//') || 
            href.startsWith('#') || 
            element.hasAttribute('download') ||
            element.hasAttribute('target')) {
          return;
        }
        
        // Handle internal link
        event.preventDefault();
        this.navigateTo(href);
        return;
      }
      element = element.parentElement;
    }
  }
  
  /**
   * Navigate to a specific route
   */
  navigateTo(path, state = null, pushState = true) {
    if (this.isNavigating) return;
    this.isNavigating = true;
    
    try {
      // Find matching route
      const route = this.findRoute(path);
      
      // Handle 404
      if (!route) {
        console.warn(`Route not found: ${path}`);
        this.navigateTo('/404');
        this.isNavigating = false;
        return;
      }
      
      // Check authentication requirements
      if (route.requiresAuth && !userProfile.isAuthenticated()) {
        console.warn(`Route ${path} requires authentication`);
        // Save intended destination for post-login redirect
        sessionStorage.setItem('auth_redirect', path);
        this.navigateTo('/login');
        this.isNavigating = false;
        return;
      }
      
      // Check permission requirements
      if (route.requiredPermission && !userProfile.hasPermission(route.requiredPermission)) {
        console.warn(`Route ${path} requires permission: ${route.requiredPermission}`);
        this.navigateTo('/home');
        this.isNavigating = false;
        return;
      }
      
      // Extract route parameters
      const params = this.extractRouteParams(route.path, path);
      
      // Create route context
      const routeContext = {
        path,
        route,
        params,
        state,
        timestamp: Date.now()
      };
      
      // Update current route
      this.currentRoute = routeContext;
      
      // Update browser history
      if (pushState) {
        window.history.pushState(state, route.title, path);
      }
      
      // Update page title
      document.title = `StayCrest - ${route.title}`;
      
      // Track page view in analytics
      Analytics.trackEvent('page_view', {
        path,
        title: route.title,
        userId: userProfile.getUser()?.id
      });
      
      // Notify listeners
      this.notifyRouteChange(routeContext);
      
      // Handle components
      this.loadRouteComponent(route.component, routeContext);
    } finally {
      this.isNavigating = false;
    }
  }
  
  /**
   * Find matching route for path
   */
  findRoute(path) {
    // First try exact match
    let route = this.routes.find(r => r.path === path);
    if (route) return route;
    
    // Then try pattern match
    for (const route of this.routes) {
      if (this.isPathMatch(route.path, path)) {
        return route;
      }
    }
    
    return null;
  }
  
  /**
   * Check if path matches a route pattern
   */
  isPathMatch(pattern, path) {
    // Convert route pattern to regex
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return false;
    }
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];
      
      // Skip empty parts
      if (!patternPart && !pathPart) continue;
      
      // Check for parameter part
      if (patternPart.startsWith(':')) {
        // Parameter part, always matches
        continue;
      }
      
      // Regular part, must match exactly
      if (patternPart !== pathPart) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Extract route parameters from path
   */
  extractRouteParams(pattern, path) {
    const params = {};
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      
      if (patternPart.startsWith(':')) {
        // Extract parameter
        const paramName = patternPart.substring(1);
        params[paramName] = pathParts[i];
      }
    }
    
    return params;
  }
  
  /**
   * Load route component
   */
  loadRouteComponent(componentName, routeContext) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => {
      el.style.display = 'none';
    });
    
    // Show matching view
    const viewElement = document.querySelector(`.view.${componentName}`);
    if (viewElement) {
      viewElement.style.display = 'block';
      
      // Dispatch route event to the component
      viewElement.dispatchEvent(new CustomEvent('route-changed', {
        detail: routeContext
      }));
    } else {
      console.error(`View element not found: ${componentName}`);
    }
  }
  
  /**
   * Navigate back
   */
  back() {
    window.history.back();
  }
  
  /**
   * Get current route
   */
  getCurrentRoute() {
    return this.currentRoute;
  }
  
  /**
   * Add route change listener
   */
  addRouteChangeListener(callback) {
    this.routeChangeListeners.push(callback);
    return () => this.removeRouteChangeListener(callback);
  }
  
  /**
   * Remove route change listener
   */
  removeRouteChangeListener(callback) {
    this.routeChangeListeners = this.routeChangeListeners.filter(cb => cb !== callback);
  }
  
  /**
   * Notify route change listeners
   */
  notifyRouteChange(routeContext) {
    this.routeChangeListeners.forEach(listener => {
      try {
        listener(routeContext);
      } catch (error) {
        console.error('Error in route change listener:', error);
      }
    });
    
    // Dispatch DOM event for components
    window.dispatchEvent(new CustomEvent('route-changed', {
      detail: routeContext
    }));
  }
}

// Create singleton instance
const navigation = new DirectNavigation();

export default navigation; 