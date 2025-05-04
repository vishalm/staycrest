// Auth.js - Modern Login and Registration Component for StayCrest

/**
 * StayCrest Auth Component
 * Provides a modern authentication experience with login and registration forms,
 * social login options, form validation, and smooth animations.
 */

class Auth {
  constructor(containerId = 'auth-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      document.body.appendChild(this.container);
    }
    
    this.currentMode = 'login'; // 'login' or 'register'
    this.isLoading = false;
    this.init();
  }
  
  /**
   * Initialize the auth component
   */
  init() {
    // Create initial HTML structure
    this.render();
    
    // Add event listeners
    this.addEventListeners();
  }
  
  /**
   * Render the appropriate form based on current mode
   */
  render() {
    this.container.innerHTML = '';
    this.container.className = 'auth-container fade-in';
    
    // Render login or registration form based on current mode
    if (this.currentMode === 'login') {
      this.renderLoginForm();
    } else {
      this.renderRegistrationForm();
    }
  }
  
  /**
   * Create and render the login form
   */
  renderLoginForm() {
    const form = document.createElement('div');
    form.className = 'auth-form slide-in-up';
    
    form.innerHTML = `
      <h2 class="auth-title">Welcome back</h2>
      <p class="auth-subtitle">Sign in to continue to StayCrest</p>
      
      <div class="auth-social-buttons">
        <button type="button" class="btn btn--outline btn--full btn--icon" data-provider="google">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <button type="button" class="btn btn--outline btn--full btn--icon" data-provider="apple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.51-3.23 0-1.44.64-2.18.5-3.08-.38C3.11 15.59 3.74 8.3 8.62 8c1.19.05 2.02.5 2.95.53 1.14-.1 2.23-.58 3.33-.49 1.25.1 2.24.63 2.87 1.61-2.6 1.56-1.94 4.7.78 5.53-.58 1.83-1.39 3.68-2.5 5.1zM12.03 8c-.07-2.47 2.11-4.49 4.43-4.5.17 2.05-1.9 4.5-4.43 4.5z"/>
          </svg>
          Continue with Apple
        </button>
      </div>
      
      <div class="auth-divider">
        <span>or</span>
      </div>
      
      <form id="login-form">
        <div class="form-group">
          <label for="email" class="form-label">Email</label>
          <input type="email" id="email" class="form-input" placeholder="you@example.com" required autocomplete="email">
          <div class="form-error hidden" id="email-error"></div>
        </div>
        
        <div class="form-group">
          <div class="flex items-center justify-between">
            <label for="password" class="form-label">Password</label>
            <a href="#" class="text-sm text-primary" id="forgot-password">Forgot password?</a>
          </div>
          <input type="password" id="password" class="form-input" placeholder="••••••••" required autocomplete="current-password">
          <div class="form-error hidden" id="password-error"></div>
        </div>
        
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="remember-me">
            <span>Remember me</span>
          </label>
        </div>
        
        <button type="submit" class="btn btn--primary btn--full" id="login-button">
          <span>Sign in</span>
          <span class="loading-spinner hidden"></span>
        </button>
      </form>
      
      <div class="auth-footer">
        <p>Don't have an account? <a href="#" id="switch-to-register">Create account</a></p>
      </div>
    `;
    
    this.container.appendChild(form);
  }
  
  /**
   * Create and render the registration form
   */
  renderRegistrationForm() {
    const form = document.createElement('div');
    form.className = 'auth-form slide-in-up';
    
    form.innerHTML = `
      <h2 class="auth-title">Create your account</h2>
      <p class="auth-subtitle">Join StayCrest for the best hotel deals</p>
      
      <div class="auth-social-buttons">
        <button type="button" class="btn btn--outline btn--full btn--icon" data-provider="google">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <button type="button" class="btn btn--outline btn--full btn--icon" data-provider="apple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.51-3.23 0-1.44.64-2.18.5-3.08-.38C3.11 15.59 3.74 8.3 8.62 8c1.19.05 2.02.5 2.95.53 1.14-.1 2.23-.58 3.33-.49 1.25.1 2.24.63 2.87 1.61-2.6 1.56-1.94 4.7.78 5.53-.58 1.83-1.39 3.68-2.5 5.1zM12.03 8c-.07-2.47 2.11-4.49 4.43-4.5.17 2.05-1.9 4.5-4.43 4.5z"/>
          </svg>
          Continue with Apple
        </button>
      </div>
      
      <div class="auth-divider">
        <span>or</span>
      </div>
      
      <form id="register-form">
        <div class="form-group">
          <label for="name" class="form-label">Full name</label>
          <input type="text" id="name" class="form-input" placeholder="John Doe" required autocomplete="name">
          <div class="form-error hidden" id="name-error"></div>
        </div>
        
        <div class="form-group">
          <label for="reg-email" class="form-label">Email</label>
          <input type="email" id="reg-email" class="form-input" placeholder="you@example.com" required autocomplete="email">
          <div class="form-error hidden" id="reg-email-error"></div>
        </div>
        
        <div class="form-group">
          <label for="reg-password" class="form-label">Password</label>
          <input type="password" id="reg-password" class="form-input" placeholder="••••••••" required autocomplete="new-password">
          <div class="form-error hidden" id="reg-password-error"></div>
        </div>
        
        <div class="form-group">
          <label for="password-confirm" class="form-label">Confirm password</label>
          <input type="password" id="password-confirm" class="form-input" placeholder="••••••••" required autocomplete="new-password">
          <div class="form-error hidden" id="password-confirm-error"></div>
        </div>
        
        <div class="form-group">
          <label class="form-checkbox">
            <input type="checkbox" id="terms" required>
            <span>I agree to the <a href="#" target="_blank">Terms of Service</a> and <a href="#" target="_blank">Privacy Policy</a></span>
          </label>
          <div class="form-error hidden" id="terms-error"></div>
        </div>
        
        <button type="submit" class="btn btn--primary btn--full" id="register-button">
          <span>Create account</span>
          <span class="loading-spinner hidden"></span>
        </button>
      </form>
      
      <div class="auth-footer">
        <p>Already have an account? <a href="#" id="switch-to-login">Sign in</a></p>
      </div>
    `;
    
    this.container.appendChild(form);
  }
  
  /**
   * Set up event listeners for forms and buttons
   */
  addEventListeners() {
    // Wait for DOM to be ready
    setTimeout(() => {
      // Mode switching
      const switchToRegister = document.getElementById('switch-to-register');
      if (switchToRegister) {
        switchToRegister.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchMode('register');
        });
      }
      
      const switchToLogin = document.getElementById('switch-to-login');
      if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchMode('login');
        });
      }
      
      // Form submissions
      const loginForm = document.getElementById('login-form');
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleLogin();
        });
      }
      
      const registerForm = document.getElementById('register-form');
      if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleRegister();
        });
      }
      
      // Social login buttons
      const socialButtons = document.querySelectorAll('[data-provider]');
      socialButtons.forEach(button => {
        button.addEventListener('click', () => {
          const provider = button.getAttribute('data-provider');
          this.handleSocialLogin(provider);
        });
      });
      
      // Forgot password
      const forgotPassword = document.getElementById('forgot-password');
      if (forgotPassword) {
        forgotPassword.addEventListener('click', (e) => {
          e.preventDefault();
          this.handleForgotPassword();
        });
      }
    }, 0);
  }
  
  /**
   * Switch between login and registration forms
   * @param {string} mode - 'login' or 'register'
   */
  switchMode(mode) {
    if (this.currentMode === mode) return;
    
    // Add exit animation
    const currentForm = document.querySelector('.auth-form');
    currentForm.classList.remove('slide-in-up');
    currentForm.classList.add('slide-out-down');
    
    // Switch mode and re-render after animation
    setTimeout(() => {
      this.currentMode = mode;
      this.render();
      this.addEventListeners();
    }, 300);
  }
  
  /**
   * Handle login form submission
   */
  handleLogin() {
    if (this.isLoading) return;
    this.isLoading = true;
    
    // Show loading state
    this.setLoading(true, 'login');
    
    // Reset previous errors
    this.resetErrors();
    
    // Get form values
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember-me').checked;
    
    // Validate form
    let isValid = true;
    
    if (!this.validateEmail(email)) {
      this.showError('email', 'Please enter a valid email address');
      isValid = false;
    }
    
    if (!password) {
      this.showError('password', 'Password is required');
      isValid = false;
    }
    
    if (!isValid) {
      this.isLoading = false;
      this.setLoading(false, 'login');
      return;
    }
    
    // Mock API call with timeout to simulate network request
    setTimeout(() => {
      // Simulate successful login (you would call your API here)
      console.log('Login:', { email, password, rememberMe });
      
      // Hide loading state
      this.setLoading(false, 'login');
      this.isLoading = false;
      
      // Navigate to dashboard or home page after successful login
      this.onLoginSuccess();
    }, 1500);
  }
  
  /**
   * Handle registration form submission
   */
  handleRegister() {
    if (this.isLoading) return;
    this.isLoading = true;
    
    // Show loading state
    this.setLoading(true, 'register');
    
    // Reset previous errors
    this.resetErrors();
    
    // Get form values
    const name = document.getElementById('name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    const termsAccepted = document.getElementById('terms').checked;
    
    // Validate form
    let isValid = true;
    
    if (!name) {
      this.showError('name', 'Name is required');
      isValid = false;
    }
    
    if (!this.validateEmail(email)) {
      this.showError('reg-email', 'Please enter a valid email address');
      isValid = false;
    }
    
    if (!password) {
      this.showError('reg-password', 'Password is required');
      isValid = false;
    } else if (password.length < 8) {
      this.showError('reg-password', 'Password must be at least 8 characters');
      isValid = false;
    }
    
    if (password !== passwordConfirm) {
      this.showError('password-confirm', 'Passwords do not match');
      isValid = false;
    }
    
    if (!termsAccepted) {
      this.showError('terms', 'You must accept the terms and privacy policy');
      isValid = false;
    }
    
    if (!isValid) {
      this.isLoading = false;
      this.setLoading(false, 'register');
      return;
    }
    
    // Mock API call with timeout to simulate network request
    setTimeout(() => {
      // Simulate successful registration (you would call your API here)
      console.log('Register:', { name, email, password });
      
      // Hide loading state
      this.setLoading(false, 'register');
      this.isLoading = false;
      
      // Navigate to dashboard or home page after successful registration
      this.onRegisterSuccess();
    }, 1500);
  }
  
  /**
   * Handle social login (Google, Apple, etc.)
   * @param {string} provider - The social login provider
   */
  handleSocialLogin(provider) {
    if (this.isLoading) return;
    this.isLoading = true;
    
    console.log(`Social login with ${provider}`);
    
    // Mock API call with timeout to simulate network request
    setTimeout(() => {
      // Simulate successful login
      this.isLoading = false;
      
      // Navigate to dashboard or home page after successful login
      this.onLoginSuccess();
    }, 1500);
  }
  
  /**
   * Handle forgot password flow
   */
  handleForgotPassword() {
    // You can implement a forgot password modal or page redirect here
    alert('Forgot password flow would go here');
  }
  
  /**
   * Actions to perform after successful login
   */
  onLoginSuccess() {
    // Redirect to dashboard or show welcome screen
    window.location.href = '/dashboard';
  }
  
  /**
   * Actions to perform after successful registration
   */
  onRegisterSuccess() {
    // Redirect to onboarding or dashboard
    window.location.href = '/onboarding';
  }
  
  /**
   * Show error message for a specific field
   * @param {string} field - Field ID
   * @param {string} message - Error message
   */
  showError(field, message) {
    const errorElement = document.getElementById(`${field}-error`);
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
      
      // Highlight the input field
      const inputElement = document.getElementById(field);
      if (inputElement) {
        inputElement.classList.add('error');
      }
    }
  }
  
  /**
   * Reset all form errors
   */
  resetErrors() {
    const errorElements = document.querySelectorAll('.form-error');
    errorElements.forEach(element => {
      element.textContent = '';
      element.classList.add('hidden');
    });
    
    const inputElements = document.querySelectorAll('.form-input');
    inputElements.forEach(element => {
      element.classList.remove('error');
    });
  }
  
  /**
   * Toggle loading state for a form
   * @param {boolean} isLoading - Whether to show loading state
   * @param {string} type - 'login' or 'register'
   */
  setLoading(isLoading, type) {
    const buttonId = type === 'login' ? 'login-button' : 'register-button';
    const button = document.getElementById(buttonId);
    const spinner = button.querySelector('.loading-spinner');
    const text = button.querySelector('span:not(.loading-spinner)');
    
    if (isLoading) {
      spinner.classList.remove('hidden');
      text.style.opacity = '0';
      button.disabled = true;
    } else {
      spinner.classList.add('hidden');
      text.style.opacity = '1';
      button.disabled = false;
    }
  }
  
  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Whether the email is valid
   */
  validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }
}

// Export the Auth component
export default Auth; 