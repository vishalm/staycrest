/**
 * Theme Manager Module
 * 
 * Handles theme switching and preferences for the StayCrest application.
 */

/**
 * Initialize theme manager
 * @param {Object} options - Configuration options
 * @returns {Object} Theme manager methods
 */
export function initThemeManager(options = {}) {
  // Default options
  const config = {
    defaultTheme: 'light',  // 'light', 'dark', or 'system'
    storageKey: 'theme',
    onThemeChange: null,
    ...options
  };
  
  // State
  const state = {
    currentTheme: null,
    systemPrefersDark: false,
    mediaQuery: null,
    isTransitioning: false
  };
  
  /**
   * Initialize theme manager
   */
  function init() {
    // Create media query for system preference
    state.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    state.systemPrefersDark = state.mediaQuery.matches;
    
    // Add listener for system preference changes
    state.mediaQuery.addEventListener('change', handleSystemPreferenceChange);
    
    // Load theme preference from storage
    const savedTheme = localStorage.getItem(config.storageKey);
    
    // Set initial theme (saved or default)
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      state.currentTheme = savedTheme;
    } else {
      state.currentTheme = config.defaultTheme;
    }
    
    // Apply the theme
    applyTheme(false);
    
    // Setup event listener for theme toggle
    setupThemeToggleListener();
  }
  
  /**
   * Set up event listener for theme toggle button
   */
  function setupThemeToggleListener() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        toggleTheme();
      });
    }
  }
  
  /**
   * Apply the current theme to the document
   * @param {boolean} animate - Whether to animate the transition
   */
  function applyTheme(animate = true) {
    const effectiveTheme = getEffectiveTheme();
    
    // Don't apply multiple times in quick succession
    if (state.isTransitioning) return;
    
    // Set transitioning state
    if (animate) {
      state.isTransitioning = true;
      setTimeout(() => {
        state.isTransitioning = false;
      }, 300); // Match to CSS transition duration
    }
    
    // Set the theme attribute on the document
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Also set the class on body for older browsers
    document.body.classList.toggle('dark-mode', effectiveTheme === 'dark');
    
    // Update icon in theme toggle button
    const themeButton = document.getElementById('themeToggle');
    if (themeButton) {
      const themeIcon = themeButton.querySelector('.header__theme-icon');
      if (themeIcon) {
        if (effectiveTheme === 'dark') {
          themeIcon.textContent = '☀️';
          themeIcon.setAttribute('title', 'Switch to light mode');
          themeButton.setAttribute('aria-label', 'Switch to light mode');
        } else {
          themeIcon.textContent = '🌙';
          themeIcon.setAttribute('title', 'Switch to dark mode');
          themeButton.setAttribute('aria-label', 'Switch to dark mode');
        }
        
        // Add subtle animation to the icon
        if (animate) {
          themeIcon.style.animation = 'none';
          void themeIcon.offsetWidth; // Trigger reflow
          themeIcon.style.animation = 'themeIconSpin 0.5s ease-in-out';
        }
      }
    }
    
    // Add animation to body
    if (animate) {
      document.body.classList.add('theme-transition');
      setTimeout(() => {
        document.body.classList.remove('theme-transition');
      }, 500);
    }
    
    // Save theme preference to storage
    localStorage.setItem(config.storageKey, state.currentTheme);
    
    // Call the theme change callback if provided
    if (typeof config.onThemeChange === 'function') {
      config.onThemeChange(effectiveTheme);
    }
    
    // Return the effective theme
    return effectiveTheme;
  }
  
  /**
   * Get the effective theme (resolving 'system' preference)
   * @returns {string} 'light' or 'dark'
   */
  function getEffectiveTheme() {
    if (state.currentTheme === 'system') {
      return state.systemPrefersDark ? 'dark' : 'light';
    }
    return state.currentTheme;
  }
  
  /**
   * Handle system color scheme preference changes
   * @param {MediaQueryListEvent} event - Media query change event
   */
  function handleSystemPreferenceChange(event) {
    state.systemPrefersDark = event.matches;
    
    // Only apply theme if we're using system preference
    if (state.currentTheme === 'system') {
      applyTheme();
    }
  }
  
  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const currentEffective = getEffectiveTheme();
    const newTheme = currentEffective === 'dark' ? 'light' : 'dark';
    
    state.currentTheme = newTheme;
    const effectiveTheme = applyTheme(true);
    
    // Log theme change for debugging
    console.log(`Theme changed to: ${effectiveTheme}`);
    
    return effectiveTheme;
  }
  
  /**
   * Set theme explicitly
   * @param {string} theme - Theme to set ('light', 'dark', or 'system')
   */
  function setTheme(theme) {
    if (!['light', 'dark', 'system'].includes(theme)) {
      console.error('Invalid theme:', theme);
      return;
    }
    
    state.currentTheme = theme;
    return applyTheme(true);
  }
  
  /**
   * Get current theme setting
   * @returns {Object} Current theme information
   */
  function getThemeInfo() {
    return {
      setting: state.currentTheme,
      effective: getEffectiveTheme(),
      systemPrefersDark: state.systemPrefersDark
    };
  }
  
  // Initialize on creation
  init();
  
  // Return public API
  return {
    toggleTheme,
    setTheme,
    getThemeInfo
  };
} 