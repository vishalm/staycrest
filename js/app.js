/**
 * StayCrest - Main Application Logic
 * 
 * This file contains the core application logic for the StayCrest platform,
 * including chat functionality, voice interactions, and API communication.
 */

// Import modules and services
import { initChatInterface } from './modules/chat-interface.js';
import { initVoiceControls } from './modules/voice-controls.js';
import { initThemeManager } from './modules/theme-manager.js';
import { ApiService } from './services/api-service.js';
import { VoiceService } from './services/voice-service.js';

// Configuration
const config = {
  apiBaseUrl: 'http://localhost:3000/api',
  websocketUrl: 'ws://localhost:3000',
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
};

/**
 * Initialize the application
 */
function initApp() {
  // Check if user is logged in
  checkAuthStatus();
  
  // Initialize services
  const apiService = new ApiService(config.apiBaseUrl);
  const voiceService = new VoiceService(config.enableVoice);
  
  // Initialize UI modules
  const themeManager = initThemeManager({
    defaultTheme: localStorage.getItem('theme') || config.defaultTheme,
    onThemeChange: handleThemeChange,
  });
  
  // Make themeManager available in the global namespace for debugging
  window.themeManager = themeManager;
  
  initChatInterface({
    onSendMessage: handleSendMessage,
    onClearChat: handleClearChat,
    onSaveSearch: handleSaveSearch,
  });
  
  // Initialize voice controls if enabled
  if (config.enableVoice) {
    initVoiceControls({
      onVoiceInput: handleVoiceInput,
      onVoiceStart: handleVoiceStart,
      onVoiceEnd: handleVoiceEnd,
      onVoiceError: handleVoiceError,
    });
  }
  
  // Setup WebSocket connection
  setupWebSocket();
  
  // UI Event listeners
  setupEventListeners();
  
  // Load feature flags
  loadFeatureFlags();
  
  // Initialize welcome message
  renderWelcomeMessage();
  
  console.log('StayCrest application initialized');
}

/**
 * Set up WebSocket connection
 */
function setupWebSocket() {
  const socket = new WebSocket(config.websocketUrl);
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
    
    // Send authentication if user is logged in
    if (appState.isAuthenticated && appState.user) {
      socket.send(JSON.stringify({
        type: 'auth',
        token: localStorage.getItem('token'),
        sessionId: appState.currentChat.sessionId,
      }));
    } else {
      // For guest users
      socket.send(JSON.stringify({
        type: 'session',
        sessionId: appState.currentChat.sessionId,
      }));
    }
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleSocketMessage(data);
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    console.log('WebSocket connection closed');
    // Attempt to reconnect after a delay
    setTimeout(() => setupWebSocket(), 3000);
  };
  
  // Store the socket in app state for later use
  appState.socket = socket;
}

/**
 * Handle incoming WebSocket messages
 */
function handleSocketMessage(data) {
  switch (data.type) {
    case 'chat_message':
      // Add message to chat
      addMessageToChat({
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
      });
      break;
      
    case 'search_results':
      // Display search results
      appState.searchResults = data;
      renderSearchResults(data);
      break;
      
    case 'session':
      // Update session info
      appState.currentChat.sessionId = data.sessionId;
      if (data.authenticated) {
        appState.isAuthenticated = true;
        appState.user = data.user;
        updateUserInterface();
      }
      break;
      
    default:
      console.log('Unhandled message type:', data.type);
  }
}

/**
 * Check authentication status
 */
function checkAuthStatus() {
  const token = localStorage.getItem('token');
  
  if (token) {
    // Validate token and get user info
    fetch(`${config.apiBaseUrl}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        appState.isAuthenticated = true;
        appState.user = data.data.user;
        updateUserInterface();
      } else {
        // Token invalid, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    })
    .catch(err => {
      console.error('Auth check error:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    });
  }
}

/**
 * Update UI based on authentication status
 */
function updateUserInterface() {
  const loginButton = document.getElementById('loginButton');
  const userProfile = document.getElementById('userProfile');
  
  if (appState.isAuthenticated && appState.user) {
    // Hide login button, show user profile
    loginButton.classList.add('hidden');
    userProfile.classList.remove('hidden');
    
    // Load user data
    loadUserData();
  } else {
    // Show login button, hide user profile
    loginButton.classList.remove('hidden');
    userProfile.classList.add('hidden');
  }
}

/**
 * Load user-specific data like saved searches
 */
function loadUserData() {
  if (!appState.isAuthenticated) return;
  
  // Load saved searches
  fetch(`${config.apiBaseUrl}/user/searches?saved=true`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      renderSavedSearches(data.data.searches);
    }
  })
  .catch(err => console.error('Error loading saved searches:', err));
  
  // Load conversations
  // (Implementation will be added)
}

/**
 * Handle sending a new message
 */
function handleSendMessage(message) {
  if (!message || message.trim() === '') return;
  
  // Add message to chat
  addMessageToChat({
    role: 'user',
    content: message,
    timestamp: new Date(),
  });
  
  // Send message via WebSocket
  if (appState.socket && appState.socket.readyState === WebSocket.OPEN) {
    appState.socket.send(JSON.stringify({
      type: 'chat_message',
      message,
      sessionId: appState.currentChat.sessionId,
    }));
  } else {
    console.error('WebSocket not connected');
    // Fallback to HTTP API
    fetch(`${config.apiBaseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': appState.isAuthenticated ? `Bearer ${localStorage.getItem('token')}` : '',
      },
      body: JSON.stringify({
        message,
        sessionId: appState.currentChat.sessionId,
      }),
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        addMessageToChat({
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date(),
        });
      }
    })
    .catch(err => console.error('Error sending message:', err));
  }
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
 * Handle voice input
 */
function handleVoiceInput(transcript, isFinal) {
  const voiceText = document.getElementById('voiceText');
  
  if (isFinal) {
    // Send final transcript as a message
    handleSendMessage(transcript);
    document.getElementById('voiceFeedback').classList.add('hidden');
  } else {
    // Update the UI with interim transcript
    voiceText.textContent = transcript || 'Listening...';
  }
}

/**
 * Handle voice recognition start
 */
function handleVoiceStart() {
  document.getElementById('voiceFeedback').classList.remove('hidden');
  appState.voiceActive = true;
}

/**
 * Handle voice recognition end
 */
function handleVoiceEnd() {
  document.getElementById('voiceFeedback').classList.add('hidden');
  appState.voiceActive = false;
}

/**
 * Handle voice recognition error
 */
function handleVoiceError(error) {
  console.error('Voice recognition error:', error);
  document.getElementById('voiceFeedback').classList.add('hidden');
  appState.voiceActive = false;
}

/**
 * Handle theme change
 */
function handleThemeChange(theme) {
  appState.darkMode = theme === 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.toggle('dark-mode', appState.darkMode);
  
  // Update UI elements that need theme-specific adjustments
  updateThemeSpecificUI(theme);
  
  localStorage.setItem('theme', theme);
  console.log(`Theme changed to: ${theme}`);
}

// Add a new function for theme-specific UI updates
function updateThemeSpecificUI(theme) {
  const isDark = theme === 'dark';
  
  // Update meta theme color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#111827' : '#ffffff');
  }
  
  // You can add other theme-specific UI updates here
}

/**
 * Handle clear chat action
 */
function handleClearChat() {
  // Clear chat history
  appState.currentChat.messages = [];
  
  // Generate new session ID
  appState.currentChat.sessionId = generateSessionId();
  
  // Clear UI
  const chatMessages = document.getElementById('chatMessages');
  chatMessages.innerHTML = '';
  
  // Add welcome message
  renderWelcomeMessage();
}

/**
 * Handle saving a search
 */
function handleSaveSearch() {
  if (!appState.searchResults || !appState.isAuthenticated) return;
  
  fetch(`${config.apiBaseUrl}/user/searches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify({
      query: appState.searchResults.query,
      parameters: appState.searchResults.parameters,
      loyaltyPrograms: appState.searchResults.loyaltyPrograms,
    }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'success') {
      console.log('Search saved successfully');
      // Reload saved searches
      loadUserData();
    }
  })
  .catch(err => console.error('Error saving search:', err));
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
      </div>
    `;
    return;
  }
  
  // Create results HTML
  const resultsHTML = results.hotels.map(hotel => `
    <div class="hotel-card">
      <div class="hotel-card__image">
        <img src="${hotel.image || 'assets/images/hotel-placeholder.jpg'}" alt="${hotel.name}">
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
    </div>
  `;
  
  // Add event listener for save button
  document.getElementById('saveSearchButton')?.addEventListener('click', handleSaveSearch);
}

/**
 * Render saved searches in sidebar
 */
function renderSavedSearches(searches) {
  const savedSearchesList = document.getElementById('savedSearchesList');
  
  // Clear list
  savedSearchesList.innerHTML = '';
  
  if (!searches || searches.length === 0) {
    savedSearchesList.innerHTML = `
      <li class="chat-sidebar__item chat-sidebar__item--empty">
        <span class="chat-sidebar__text">No saved searches yet</span>
      </li>
    `;
    return;
  }
  
  // Add each search to the list
  searches.forEach(search => {
    const searchItem = document.createElement('li');
    searchItem.className = 'chat-sidebar__item';
    searchItem.dataset.id = search.id;
    searchItem.innerHTML = `
      <span class="chat-sidebar__icon">🔍</span>
      <span class="chat-sidebar__text">${search.query}</span>
    `;
    
    // Add event listener to load this search when clicked
    searchItem.addEventListener('click', () => {
      // Load search results
      // (Implementation will be added)
    });
    
    savedSearchesList.appendChild(searchItem);
  });
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
 * Load feature flags from API
 */
function loadFeatureFlags() {
  fetch(`${config.apiBaseUrl}/features`)
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        // Update app config based on feature flags
        config.enableVoice = data.data.features.voiceCommands;
        
        // Update UI based on features
        if (!config.enableVoice) {
          document.getElementById('voiceButton')?.classList.add('hidden');
        }
      }
    })
    .catch(err => console.error('Error loading feature flags:', err));
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Login button
  document.getElementById('loginButton')?.addEventListener('click', () => {
    // Show login modal (Implementation will be added)
  });
  
  // Voice button
  document.getElementById('voiceButton')?.addEventListener('click', () => {
    if (appState.voiceActive) {
      // Stop voice recognition
      const voiceService = new VoiceService(true);
      voiceService.stopListening();
    } else {
      // Start voice recognition
      const voiceService = new VoiceService(true);
      voiceService.startListening();
    }
  });
  
  // Voice cancel button
  document.getElementById('voiceCancelButton')?.addEventListener('click', () => {
    document.getElementById('voiceFeedback').classList.add('hidden');
    appState.voiceActive = false;
    
    // Stop voice recognition
    const voiceService = new VoiceService(true);
    voiceService.stopListening();
  });
  
  // Close details panel
  document.getElementById('detailsCloseButton')?.addEventListener('click', () => {
    document.querySelector('.chat-details').style.display = 'none';
  });
  
  // Send message on Enter (not Shift+Enter)
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const message = e.target.value.trim();
      if (message) {
        handleSendMessage(message);
        e.target.value = '';
      }
    }
  });
  
  // Send button
  document.getElementById('sendButton')?.addEventListener('click', () => {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    if (message) {
      handleSendMessage(message);
      chatInput.value = '';
    }
  });
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