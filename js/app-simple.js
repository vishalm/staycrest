/**
 * StayCrest - Simple Application Logic
 * 
 * This is a simplified version of app.js that doesn't use ES modules.
 * It provides basic functionality for theme toggling and button clicks.
 */

// Configuration
const config = {
  apiBaseUrl: 'http://localhost:3000/api',
  defaultTheme: 'light',
  enableVoice: true,
};

// State management
const appState = {
  isAuthenticated: false,
  user: null,
  currentChat: {
    id: null,
    sessionId: generateSessionId(),
    messages: [],
  },
  searchResults: null,
  activeView: 'chat', // 'chat', 'search', 'profile'
  voiceActive: false,
  darkMode: localStorage.getItem('theme') === 'dark',
  isLoading: false,
};

/**
 * Initialize the application
 */
function initApp() {
  console.log('Initializing app-simple.js');
  
  // Setup debug 
  setupDebug();
  
  // Apply theme based on saved preference
  applyTheme(localStorage.getItem('theme') || config.defaultTheme);
  
  // Setup event listeners
  setupEventListeners();
  
  // Initialize welcome message
  renderWelcomeMessage();
  
  // Load feature flags from API
  loadFeatureFlags();
  
  // Log init
  updateDebug('App initialized');
  console.log('StayCrest application initialized (simple version)');
}

/**
 * Setup debug functionality
 */
function setupDebug() {
  // Update current theme display
  const currentTheme = localStorage.getItem('theme') || config.defaultTheme;
  const currentThemeElement = document.getElementById('current-theme');
  if (currentThemeElement) {
    currentThemeElement.textContent = currentTheme;
  }
  
  // Add key press for debugging
  document.addEventListener('keydown', function(e) {
    // Press D to toggle debug display
    if (e.key === 'd' && e.ctrlKey) {
      document.body.classList.toggle('show-debug');
    }
    
    // Press T to toggle theme
    if (e.key === 't' && e.ctrlKey) {
      const newTheme = appState.darkMode ? 'light' : 'dark';
      applyTheme(newTheme);
      updateDebug(`Theme toggled to ${newTheme} via keyboard`);
    }
  });
  
  // Add debug class to help visualize hover states
  if (location.search.includes('debug=hover')) {
    document.body.classList.add('debug-hover-styles');
  }
}

/**
 * Update debug info
 */
function updateDebug(action) {
  const lastActionElement = document.getElementById('last-action');
  const currentThemeElement = document.getElementById('current-theme');
  
  if (lastActionElement) {
    lastActionElement.textContent = action;
  }
  
  if (currentThemeElement) {
    currentThemeElement.textContent = appState.darkMode ? 'dark' : 'light';
  }
}

/**
 * Apply theme to the document
 */
function applyTheme(theme) {
  console.log('Applying theme:', theme);
  
  // Convert to standard values
  theme = theme === 'dark' ? 'dark' : 'light';
  
  const isDark = theme === 'dark';
  appState.darkMode = isDark;
  
  // Set theme attribute and class
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('dark-mode', isDark);
  
  // Update theme toggle button
  const themeButton = document.getElementById('themeToggle');
  if (themeButton) {
    const themeIcon = themeButton.querySelector('.header__theme-icon');
    if (themeIcon) {
      themeIcon.textContent = isDark ? '☀️' : '🌙';
      themeIcon.setAttribute('title', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      themeButton.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    } else {
      console.error('Theme icon not found in theme toggle button');
      updateDebug('ERROR: Theme icon not found');
    }
  } else {
    console.error('Theme toggle button not found');
    updateDebug('ERROR: Theme toggle button not found');
  }
  
  // Directly modify CSS custom properties too
  document.documentElement.style.setProperty('--theme-transition', 'all 0.3s ease');
  
  // Save preference
  localStorage.setItem('theme', theme);
  
  // Update meta theme color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#111827' : '#ffffff');
  }
  
  // Apply transition effect
  document.body.classList.add('theme-transition');
  setTimeout(() => {
    document.body.classList.remove('theme-transition');
  }, 500);
  
  // Update debug
  updateDebug(`Theme changed to ${theme}`);
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  console.log('Setting up event listeners');
  
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function(e) {
      console.log('Theme toggle clicked');
      updateDebug('Theme toggle clicked');
      
      const newTheme = appState.darkMode ? 'light' : 'dark';
      applyTheme(newTheme);
      
      // Add animation
      document.body.classList.add('theme-transition');
      setTimeout(() => {
        document.body.classList.remove('theme-transition');
      }, 500);
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  } else {
    console.error('Theme toggle button not found');
    updateDebug('ERROR: Theme toggle button not found');
  }
  
  // Login button
  const loginButton = document.getElementById('loginButton');
  if (loginButton) {
    loginButton.addEventListener('click', function(e) {
      console.log('Login button clicked');
      updateDebug('Login button clicked');
      
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.classList.add('active');
      } else {
        console.error('Login modal not found');
        updateDebug('ERROR: Login modal not found');
      }
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  } else {
    console.error('Login button not found');
    updateDebug('ERROR: Login button not found');
  }
  
  // Modal close
  const modalClose = document.getElementById('loginModalClose');
  if (modalClose) {
    modalClose.addEventListener('click', function(e) {
      console.log('Modal close clicked');
      updateDebug('Modal close clicked');
      
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.classList.remove('active');
      } else {
        console.error('Login modal not found');
        updateDebug('ERROR: Login modal not found');
      }
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  // Modal overlay click to close
  const modalOverlay = document.querySelector('.modal__overlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', function() {
      console.log('Modal overlay clicked');
      updateDebug('Modal overlay clicked');
      
      const loginModal = document.getElementById('loginModal');
      if (loginModal) {
        loginModal.classList.remove('active');
      }
    });
  }
  
  // Voice button
  const voiceButton = document.getElementById('voiceButton');
  if (voiceButton) {
    voiceButton.addEventListener('click', function(e) {
      console.log('Voice button clicked');
      updateDebug('Voice button clicked');
      
      const voiceFeedback = document.getElementById('voiceFeedback');
      if (voiceFeedback) {
        voiceFeedback.classList.toggle('hidden');
        appState.voiceActive = !appState.voiceActive;
        
        // Simulate voice recognition for demo
        if (appState.voiceActive) {
          simulateVoiceRecognition();
        }
      } else {
        console.error('Voice feedback element not found');
        updateDebug('ERROR: Voice feedback element not found');
      }
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  // Voice cancel button
  const voiceCancelButton = document.getElementById('voiceCancelButton');
  if (voiceCancelButton) {
    voiceCancelButton.addEventListener('click', function(e) {
      console.log('Voice cancel button clicked');
      updateDebug('Voice cancel button clicked');
      
      const voiceFeedback = document.getElementById('voiceFeedback');
      if (voiceFeedback) {
        voiceFeedback.classList.add('hidden');
        appState.voiceActive = false;
      } else {
        console.error('Voice feedback element not found');
        updateDebug('ERROR: Voice feedback element not found');
      }
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  // Close details panel
  const detailsCloseButton = document.getElementById('detailsCloseButton');
  if (detailsCloseButton) {
    detailsCloseButton.addEventListener('click', function(e) {
      console.log('Details close button clicked');
      updateDebug('Details close button clicked');
      
      const chatDetails = document.querySelector('.chat-details');
      if (chatDetails) {
        chatDetails.style.display = 'none';
      } else {
        console.error('Chat details element not found');
        updateDebug('ERROR: Chat details element not found');
      }
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  // Send message on Enter (not Shift+Enter)
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = e.target.value.trim();
        if (message) {
          console.log('Message sent via Enter key:', message);
          updateDebug('Message sent via Enter');
          sendChatMessage(message);
          e.target.value = '';
        }
      }
    });
  }
  
  // Send button
  const sendButton = document.getElementById('sendButton');
  if (sendButton) {
    sendButton.addEventListener('click', function(e) {
      console.log('Send button clicked');
      updateDebug('Send button clicked');
      
      const chatInput = document.getElementById('chatInput');
      if (chatInput) {
        const message = chatInput.value.trim();
        if (message) {
          console.log('Message sent via button:', message);
          sendChatMessage(message);
          chatInput.value = '';
        }
      } else {
        console.error('Chat input element not found');
        updateDebug('ERROR: Chat input element not found');
      }
      
      // Prevent event bubbling
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  console.log('Event listeners set up successfully');
  updateDebug('All event listeners set up');
}

/**
 * Send a chat message to the API
 */
function sendChatMessage(message) {
  // First add the user message to the UI
  addMessageToChat({
    role: 'user',
    content: message,
    timestamp: new Date(),
  });
  
  // Set loading state
  appState.isLoading = true;
  showTypingIndicator();
  
  // Send message to API
  fetch(`${config.apiBaseUrl}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      sessionId: appState.currentChat.sessionId,
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Network error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.status === 'success') {
      hideTypingIndicator();
      
      // Add assistant response to chat
      addMessageToChat({
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date(),
      });
      
      // Check message keywords to trigger appropriate actions
      const lowerCaseMessage = message.toLowerCase();
      
      // Hotel search keywords
      if (
        lowerCaseMessage.includes('hotel') || 
        lowerCaseMessage.includes('stay') ||
        lowerCaseMessage.includes('book') ||
        lowerCaseMessage.includes('room') ||
        lowerCaseMessage.includes('accommodation')
      ) {
        // Fetch hotel search results
        searchHotels(message);
      }
      
      // Loyalty program keywords
      else if (
        lowerCaseMessage.includes('loyalty') ||
        lowerCaseMessage.includes('points') ||
        lowerCaseMessage.includes('program') ||
        lowerCaseMessage.includes('rewards') ||
        lowerCaseMessage.includes('membership')
      ) {
        // Fetch loyalty programs
        fetchLoyaltyPrograms();
      }
    } else {
      throw new Error(data.message || 'Unknown error occurred');
    }
  })
  .catch(error => {
    console.error('Error sending message:', error);
    hideTypingIndicator();
    
    // Show error message
    addMessageToChat({
      role: 'system',
      content: `Sorry, there was an error processing your request: ${error.message}. Please try again.`,
      timestamp: new Date(),
    });
  })
  .finally(() => {
    appState.isLoading = false;
  });
}

/**
 * Show typing indicator
 */
function showTypingIndicator() {
  const chatMessages = document.getElementById('chatMessages');
  const typingIndicator = document.createElement('div');
  typingIndicator.className = 'chat-message chat-message--assistant chat-message--typing';
  typingIndicator.id = 'typingIndicator';
  typingIndicator.innerHTML = `
    <div class="chat-message__content">
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Hide typing indicator
 */
function hideTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

/**
 * Search for hotels based on query
 */
function searchHotels(query) {
  // Display loading state in search panel
  const searchResults = document.getElementById('searchResults');
  const detailsPanel = document.querySelector('.chat-details');
  
  // Show details panel with loading state
  detailsPanel.style.display = 'flex';
  searchResults.innerHTML = `
    <div class="chat-details__loading">
      <p>Searching for hotels...</p>
      <div class="loading-spinner"></div>
    </div>
  `;
  
  fetch(`${config.apiBaseUrl}/search?q=${encodeURIComponent(query)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'success') {
        // Store search results
        appState.searchResults = data.data;
        
        // Render search results
        renderSearchResults(data.data);
      } else {
        throw new Error(data.message || 'Unknown error occurred');
      }
    })
    .catch(error => {
      console.error('Error searching hotels:', error);
      
      // Show error in search panel
      searchResults.innerHTML = `
        <div class="chat-details__error">
          <p>Sorry, there was an error searching for hotels.</p>
          <p class="error-details">${error.message}</p>
          <button class="btn btn--outline" id="retrySearchButton">Retry Search</button>
        </div>
      `;
      
      // Add retry button functionality
      document.getElementById('retrySearchButton')?.addEventListener('click', function() {
        searchHotels(query);
      });
    });
}

/**
 * Render search results
 */
function renderSearchResults(results) {
  const searchResults = document.getElementById('searchResults');
  const detailsPanel = document.querySelector('.chat-details');
  
  // Show details panel
  detailsPanel.style.display = 'flex';
  
  // Clear previous results
  searchResults.innerHTML = '';
  
  if (!results || !results.hotels || results.hotels.length === 0) {
    searchResults.innerHTML = `
      <div class="chat-details__empty">
        <p>No results found for "${results.query}"</p>
        <p class="no-results-suggestion">Try adjusting your search terms or exploring these options:</p>
        <div class="suggestion-buttons">
          <button class="btn btn--outline btn--small" onclick="searchHotels('hotel')">All Hotels</button>
          <button class="btn btn--outline btn--small" onclick="searchHotels('luxury hotel')">Luxury Hotels</button>
          <button class="btn btn--outline btn--small" onclick="searchHotels('budget hotel')">Budget Hotels</button>
        </div>
      </div>
    `;
    return;
  }
  
  // Create results HTML
  const resultsHTML = results.hotels.map(hotel => `
    <div class="hotel-card">
      <div class="hotel-card__image">
        <img src="${hotel.image || 'assets/images/hotel-placeholder.jpg'}" alt="${hotel.name}" 
             onerror="this.src='assets/images/hotel-placeholder.jpg'">
      </div>
      <div class="hotel-card__content">
        <h4 class="hotel-card__name">${hotel.name}</h4>
        <p class="hotel-card__chain">${hotel.chain}</p>
        <div class="hotel-card__stats">
          <span class="hotel-card__price">${hotel.price} ${hotel.currency}</span>
          <span class="hotel-card__stars">
            ${'★'.repeat(hotel.stars)}${'☆'.repeat(5 - hotel.stars)}
          </span>
        </div>
        <p class="hotel-card__location">${hotel.location}</p>
      </div>
    </div>
  `).join('');
  
  searchResults.innerHTML = `
    <div class="results-header">
      <h4 class="results-title">Results for "${results.query}"</h4>
      <p class="results-count">${results.hotels.length} hotels found</p>
    </div>
    <div class="hotel-list">
      ${resultsHTML}
    </div>
    <div class="results-actions">
      <button class="btn btn--outline" id="saveSearchButton">
        Save Search
      </button>
      <button class="btn btn--outline btn--secondary" id="refineSearchButton">
        Refine Search
      </button>
    </div>
  `;
  
  // Add event listener for save button
  document.getElementById('saveSearchButton')?.addEventListener('click', function() {
    console.log('Save search clicked');
    updateDebug('Save search clicked');
    
    // Show notification that would normally save the search
    addMessageToChat({
      role: 'system',
      content: 'Your search has been saved!',
      timestamp: new Date(),
    });
  });
  
  // Add event listener for refine button
  document.getElementById('refineSearchButton')?.addEventListener('click', function() {
    console.log('Refine search clicked');
    updateDebug('Refine search clicked');
    
    // Add a suggestion message to the chat
    addMessageToChat({
      role: 'assistant',
      content: 'How would you like to refine your search? You can specify a location, price range, star rating, or amenities.',
      timestamp: new Date(),
    });
    
    // Focus on the chat input
    document.getElementById('chatInput').focus();
  });
}

/**
 * Simulate voice recognition for demo
 */
function simulateVoiceRecognition() {
  const voiceText = document.getElementById('voiceText');
  const sentences = [
    'I want to stay',
    'I want to stay in a',
    'I want to stay in a hotel',
    'I want to stay in a hotel in New York',
  ];
  
  // Visualize typing effect for each word
  let sentenceIndex = 0;
  const interval = setInterval(() => {
    if (sentenceIndex >= sentences.length) {
      clearInterval(interval);
      
      // End voice recognition
      setTimeout(() => {
        appState.voiceActive = false;
        document.getElementById('voiceFeedback').classList.add('hidden');
        
        // Send the final message
        sendChatMessage(sentences[sentences.length - 1]);
      }, 500);
      
      return;
    }
    
    voiceText.textContent = sentences[sentenceIndex];
    sentenceIndex++;
  }, 800);
  
  // Animate voice bars
  const bars = document.querySelectorAll('.voice-feedback__bar');
  bars.forEach(bar => {
    setInterval(() => {
      const height = Math.floor(Math.random() * 30) + 5;
      bar.style.height = `${height}px`;
    }, 200);
  });
}

/**
 * Fetch loyalty programs
 */
function fetchLoyaltyPrograms() {
  fetch(`${config.apiBaseUrl}/loyalty/programs`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'success') {
        // Show loyalty programs in a message
        const programs = data.data.programs;
        let message = 'Here are the available loyalty programs:\n\n';
        
        programs.forEach(program => {
          message += `• **${program.name}** - Point Value: ${program.pointsValue} cents per point\n`;
          message += `  Hotels: ${program.hotels.join(', ')}\n\n`;
        });
        
        addMessageToChat({
          role: 'assistant',
          content: message,
          timestamp: new Date(),
        });
      }
    })
    .catch(error => {
      console.error('Error fetching loyalty programs:', error);
      
      addMessageToChat({
        role: 'system',
        content: `Sorry, there was an error retrieving loyalty program information: ${error.message}.`,
        timestamp: new Date(),
      });
    });
}

/**
 * Load feature flags
 */
function loadFeatureFlags() {
  fetch(`${config.apiBaseUrl}/features`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network error: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.status === 'success') {
        // Apply feature flags
        config.enableVoice = data.data.features.voiceCommands;
        
        // Hide voice button if disabled
        if (!config.enableVoice) {
          const voiceButton = document.getElementById('voiceButton');
          if (voiceButton) {
            voiceButton.classList.add('hidden');
          }
        }
        
        // Apply dark mode preference if enabled in features
        if (data.data.features.darkMode) {
          // Only apply if user hasn't already set a preference
          if (!localStorage.getItem('theme')) {
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
              applyTheme('dark');
            }
          }
        }
      }
    })
    .catch(error => {
      console.error('Error loading feature flags:', error);
      // Fallback to defaults
      config.enableVoice = true;
    });
}

/**
 * Add a message to the chat interface
 */
function addMessageToChat(message) {
  // Add to state
  appState.currentChat.messages.push(message);
  
  // Update UI
  const chatMessages = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  
  messageElement.className = `chat-message chat-message--${message.role}`;
  messageElement.innerHTML = `
    <div class="chat-message__content">
      <p>${message.content}</p>
    </div>
    <div class="chat-message__meta">
      <span class="chat-message__time">
        ${formatTime(message.timestamp)}
      </span>
    </div>
  `;
  
  chatMessages.appendChild(messageElement);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Render welcome message
 */
function renderWelcomeMessage() {
  const chatMessages = document.getElementById('chatMessages');
  
  // Clear existing messages
  chatMessages.innerHTML = '';
  
  // Add welcome messages
  const welcomeMessage = document.createElement('div');
  welcomeMessage.className = 'chat-message chat-message--system';
  welcomeMessage.innerHTML = `
    <div class="chat-message__content">
      <p>Welcome to StayCrest! I'm your AI travel assistant. How can I help you today?</p>
    </div>
  `;
  
  const examplesMessage = document.createElement('div');
  examplesMessage.className = 'chat-message chat-message--system';
  examplesMessage.innerHTML = `
    <div class="chat-message__content">
      <p>You can ask me to:</p>
      <ul>
        <li>Find hotels in specific locations</li>
        <li>Compare loyalty programs</li>
        <li>Check point values and redemption options</li>
        <li>Find the best deals for your travel dates</li>
      </ul>
    </div>
  `;
  
  chatMessages.appendChild(welcomeMessage);
  chatMessages.appendChild(examplesMessage);
}

/**
 * Generate a unique session ID
 * @returns {string} A UUID
 */
function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format a date object to a time string
 * @param {Date} date - The date to format
 * @returns {string} Formatted time string (HH:MM)
 */
function formatTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp); 