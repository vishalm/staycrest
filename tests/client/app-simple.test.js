/**
 * StayCrest App-Simple Tests
 * 
 * Tests for the simplified version of the StayCrest application.
 */

describe('StayCrest App Simple', () => {
  let originalFetch;
  let fetchMock;
  let localStorageMock;
  
  // Setup mock DOM elements
  beforeEach(() => {
    // Set up document body with required elements for testing
    document.body.innerHTML = `
      <div id="debug-info">
        <div>Theme: <span id="current-theme">light</span></div>
        <div>Last Action: <span id="last-action">None</span></div>
      </div>
      <header class="header">
        <div class="container">
          <div class="header__actions">
            <button id="themeToggle" class="header__theme-toggle" aria-label="Toggle dark mode">
              <span class="header__theme-icon" title="Switch to dark mode">🌙</span>
            </button>
            <div class="header__user">
              <button id="loginButton" class="btn btn--outline">Login</button>
            </div>
          </div>
        </div>
      </header>
      <div id="chatMessages" class="chat-messages"></div>
      <div class="chat-input">
        <button class="chat-input__voice" id="voiceButton">🎤</button>
        <textarea id="chatInput" class="chat-input__textarea"></textarea>
        <button class="chat-input__submit" id="sendButton">↑</button>
      </div>
      <div id="searchResults"></div>
      <div class="chat-details">
        <div class="chat-details__header">
          <button class="chat-details__close" id="detailsCloseButton">×</button>
        </div>
      </div>
      <div id="loginModal" class="modal">
        <div class="modal__overlay"></div>
        <div class="modal__container">
          <button class="modal__close" id="loginModalClose">×</button>
        </div>
      </div>
      <div id="voiceFeedback" class="hidden">
        <div class="voice-feedback__container">
          <div class="voice-feedback__visualizer">
            <div class="voice-feedback__bar"></div>
          </div>
          <div class="voice-feedback__text" id="voiceText">Listening...</div>
          <button class="voice-feedback__cancel" id="voiceCancelButton">Cancel</button>
        </div>
      </div>
    `;
    
    // Mock localStorage
    localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });
    
    // Mock fetch API
    originalFetch = global.fetch;
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    
    // Reset mocks between tests
    jest.resetAllMocks();
    
    // Mock dispatch event
    window.dispatchEvent = jest.fn();
    window.addEventListener = jest.fn();
    document.addEventListener = jest.fn();
    
    // Default localStorage theme
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'theme') return 'light';
      return null;
    });
  });
  
  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });
  
  describe('Theme Toggle Functionality', () => {
    test('should toggle theme when the theme button is clicked', () => {
      // Load app.js script to initialize functionality
      require('../../js/app-simple.js');
      
      // Initialize by triggering DOMContentLoaded
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Get the theme toggle button and trigger click
      const themeToggle = document.getElementById('themeToggle');
      themeToggle.click();
      
      // Check if localStorage.setItem was called with the right args
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
      
      // Check if data-theme attribute was set on document element
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      
      // Check if dark-mode class was added to body
      expect(document.body.classList.contains('dark-mode')).toBe(true);
      
      // Trigger another click to toggle back to light
      themeToggle.click();
      
      // Check if localStorage.setItem was called with the right args
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'light');
      
      // Check if data-theme attribute was set on document element
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      
      // Check if dark-mode class was removed from body
      expect(document.body.classList.contains('dark-mode')).toBe(false);
    });
    
    test('should apply theme from localStorage on initialization', () => {
      // Set localStorage theme to dark
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'theme') return 'dark';
        return null;
      });
      
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Check if dark mode was applied
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.body.classList.contains('dark-mode')).toBe(true);
      
      // Check theme icon
      const themeIcon = document.querySelector('.header__theme-icon');
      expect(themeIcon.textContent).toBe('☀️');
    });
  });
  
  describe('Modal Functionality', () => {
    test('should show login modal when login button is clicked', () => {
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Get login button and trigger click
      const loginButton = document.getElementById('loginButton');
      loginButton.click();
      
      // Check if modal has active class
      const loginModal = document.getElementById('loginModal');
      expect(loginModal.classList.contains('active')).toBe(true);
    });
    
    test('should close login modal when close button is clicked', () => {
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Open modal first
      const loginModal = document.getElementById('loginModal');
      loginModal.classList.add('active');
      
      // Get close button and trigger click
      const closeButton = document.getElementById('loginModalClose');
      closeButton.click();
      
      // Check if modal has active class removed
      expect(loginModal.classList.contains('active')).toBe(false);
    });
  });
  
  describe('Chat Functionality', () => {
    test('should send a message and receive a response', async () => {
      // Mock fetch response for chat API
      fetchMock.mockImplementation((url) => {
        if (url.includes('/api/chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'success',
              data: {
                response: 'This is a test response from the assistant',
                sessionId: 'test-session-id'
              }
            })
          });
        }
        // Default feature flags response
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: {
              features: {
                voiceCommands: true,
                darkMode: true
              }
            }
          })
        });
      });
      
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Set chat input value
      const chatInput = document.getElementById('chatInput');
      chatInput.value = 'Hello, this is a test message';
      
      // Get send button and trigger click
      const sendButton = document.getElementById('sendButton');
      sendButton.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if fetch was called with the right arguments
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('Hello, this is a test message')
        })
      );
      
      // Check if user message was added to chat
      const chatMessages = document.getElementById('chatMessages');
      expect(chatMessages.innerHTML).toContain('Hello, this is a test message');
      
      // Check if response was added to chat
      expect(chatMessages.innerHTML).toContain('This is a test response from the assistant');
    });
    
    test('should show typing indicator while waiting for response', async () => {
      // Mock fetch with delayed response
      fetchMock.mockImplementation((url) => {
        if (url.includes('/api/chat')) {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () => Promise.resolve({
                  status: 'success',
                  data: {
                    response: 'Delayed response',
                    sessionId: 'test-session-id'
                  }
                })
              });
            }, 50);
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: { features: { voiceCommands: true } }
          })
        });
      });
      
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Set chat input value and send
      const chatInput = document.getElementById('chatInput');
      chatInput.value = 'Test message';
      
      // Send message
      const sendButton = document.getElementById('sendButton');
      sendButton.click();
      
      // Check for typing indicator (immediately after sending)
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(document.querySelector('.typing-indicator')).not.toBeNull();
      
      // Wait for response and check typing indicator is gone
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(document.querySelector('.typing-indicator')).toBeNull();
    });
  });
  
  describe('Voice Recognition Simulation', () => {
    test('should show voice feedback UI when voice button is clicked', () => {
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Get voice button and trigger click
      const voiceButton = document.getElementById('voiceButton');
      voiceButton.click();
      
      // Check if voice feedback is shown
      const voiceFeedback = document.getElementById('voiceFeedback');
      expect(voiceFeedback.classList.contains('hidden')).toBe(false);
    });
    
    test('should hide voice feedback when cancel button is clicked', () => {
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Show voice feedback first
      const voiceFeedback = document.getElementById('voiceFeedback');
      voiceFeedback.classList.remove('hidden');
      
      // Get cancel button and trigger click
      const cancelButton = document.getElementById('voiceCancelButton');
      cancelButton.click();
      
      // Check if voice feedback is hidden
      expect(voiceFeedback.classList.contains('hidden')).toBe(true);
    });
  });
  
  describe('Hotel Search Functionality', () => {
    test('should display hotel results when searching', async () => {
      // Mock hotel search response
      fetchMock.mockImplementation((url) => {
        if (url.includes('/api/search')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'success',
              data: {
                query: 'hotels in new york',
                hotels: [
                  {
                    id: 'hotel-1',
                    name: 'Test Hotel',
                    chain: 'Test Chain',
                    location: 'New York, NY',
                    stars: 4,
                    price: 200,
                    currency: 'USD',
                    image: 'test-image.jpg'
                  }
                ]
              }
            })
          });
        }
        // Mock chat response
        if (url.includes('/api/chat')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              status: 'success',
              data: {
                response: 'Here are some hotels in New York',
                sessionId: 'test-session-id'
              }
            })
          });
        }
        // Default feature flags
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: 'success',
            data: { features: { voiceCommands: true } }
          })
        });
      });
      
      // Initialize
      require('../../js/app-simple.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Send a message about hotels
      const chatInput = document.getElementById('chatInput');
      chatInput.value = 'hotels in new york';
      
      // Click send
      const sendButton = document.getElementById('sendButton');
      sendButton.click();
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if search results are displayed
      const searchResults = document.getElementById('searchResults');
      expect(searchResults.innerHTML).toContain('Test Hotel');
      expect(searchResults.innerHTML).toContain('New York, NY');
      expect(searchResults.innerHTML).toContain('$200 USD');
    });
  });
}); 