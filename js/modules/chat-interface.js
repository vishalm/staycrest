// js/modules/chat-interface.js

import { apiService } from '../services/api-service.js';
import { voiceService } from '../services/voice-service.js';

/**
 * Chat Interface Module
 * 
 * Handles the chat UI, message rendering, and user interactions.
 */

/**
 * Initialize the chat interface
 * @param {Object} options - Configuration options
 * @returns {Object} Chat interface controller
 */
export function initChatInterface(options = {}) {
  // Elements
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendButton');
  const detailsPanel = document.querySelector('.chat-details');
  const detailsCloseButton = document.getElementById('detailsCloseButton');
  
  // State
  const state = {
    isTyping: false,
    messages: [],
    typingTimeout: null
  };
  
  // Set up event listeners
  setupEventListeners();
  
  // Resize chat input as user types
  setupAutoResizingInput();
  
  // Focus chat input on load
  setTimeout(() => {
    chatInput.focus();
  }, 500);
  
  /**
   * Set up event listeners
   */
  function setupEventListeners() {
    // Send message on Enter (not Shift+Enter)
    chatInput.addEventListener('keydown', handleInputKeydown);
    
    // Send button click
    sendButton.addEventListener('click', sendMessage);
    
    // Close details panel
    if (detailsCloseButton) {
      detailsCloseButton.addEventListener('click', () => {
        detailsPanel.style.display = 'none';
      });
    }
    
    // Handle typing events for sending typing indicators
    chatInput.addEventListener('input', handleInputChange);
  }
  
  /**
   * Handle input keydown events
   * @param {KeyboardEvent} event - Keyboard event
   */
  function handleInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }
  
  /**
   * Handle input changes for typing indicators
   */
  function handleInputChange() {
    const isCurrentlyTyping = chatInput.value.trim().length > 0;
    
    // Check if typing status changed
    if (isCurrentlyTyping !== state.isTyping) {
      state.isTyping = isCurrentlyTyping;
      
      // Send typing indicator
      if (options.onTypingStatusChange) {
        options.onTypingStatusChange(isCurrentlyTyping);
      }
    }
    
    // Auto-resize input
    autoResizeTextarea();
    
    // Clear previous timeout
    if (state.typingTimeout) {
      clearTimeout(state.typingTimeout);
    }
    
    // Set timeout to reset typing status after 2 seconds of inactivity
    if (isCurrentlyTyping) {
      state.typingTimeout = setTimeout(() => {
        state.isTyping = false;
        
        if (options.onTypingStatusChange) {
          options.onTypingStatusChange(false);
        }
      }, 2000);
    }
  }
  
  /**
   * Send a message
   */
  function sendMessage() {
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add message to UI
    addMessageToChat('user', message);
    
    // Clear input
    chatInput.value = '';
    
    // Reset typing status
    state.isTyping = false;
    
    // Auto-resize input back to default
    autoResizeTextarea();
    
    // Callback for message sending
    if (options.onSendMessage) {
      options.onSendMessage(message);
    }
    
    // Focus input after sending
    chatInput.focus();
  }
  
  /**
   * Auto-resize textarea as content changes
   */
  function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    const newHeight = Math.min(chatInput.scrollHeight, 150); // Max height of 150px
    chatInput.style.height = `${newHeight}px`;
  }
  
  /**
   * Set up auto-resizing for the textarea
   */
  function setupAutoResizingInput() {
    // Set initial height
    autoResizeTextarea();
    
    // Add resize event to handle window size changes
    window.addEventListener('resize', autoResizeTextarea);
  }
  
  /**
   * Add a message to the chat interface
   * @param {string} role - Message role (user, assistant, system)
   * @param {string} content - Message content
   * @param {Object} metadata - Additional message metadata
   */
  function addMessageToChat(role, content, metadata = {}) {
    if (!content) return;
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message chat-message--${role}`;
    
    // Format message content (handle markdown, code, etc.)
    const formattedContent = formatMessageContent(content);
    
    // Build message HTML
    messageElement.innerHTML = `
      <div class="chat-message__content">
        ${formattedContent}
      </div>
      <div class="chat-message__meta">
        <span class="chat-message__time">${formatTime(new Date())}</span>
      </div>
    `;
    
    // Add to chat container
    chatMessages.appendChild(messageElement);
    
    // Store message in state
    state.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata
    });
    
    // Scroll to bottom
    scrollToBottom();
  }
  
  /**
   * Add a system message to the chat
   * @param {string} content - Message content
   */
  function addSystemMessage(content) {
    addMessageToChat('system', content);
  }
  
  /**
   * Add a message from the assistant
   * @param {string} content - Message content
   * @param {Object} metadata - Additional message metadata
   */
  function addAssistantMessage(content, metadata = {}) {
    addMessageToChat('assistant', content, metadata);
  }
  
  /**
   * Format message content with markdown, code highlighting, etc.
   * @param {string} content - Raw message content
   * @returns {string} Formatted HTML content
   */
  function formatMessageContent(content) {
    // This is a very basic formatter - you would want to use a proper
    // markdown parser in a production application
    
    // Replace line breaks with <br>
    let formatted = content.replace(/\n/g, '<br>');
    
    // Handle code blocks with three backticks
    formatted = formatted.replace(/```(.+?)```/gs, (match, code) => {
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });
    
    // Handle inline code with single backticks
    formatted = formatted.replace(/`([^`]+)`/g, (match, code) => {
      return `<code>${escapeHtml(code)}</code>`;
    });
    
    // Handle basic markdown for bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Handle basic markdown for italic
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
    
    // Handle links (very basic)
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    return formatted;
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} html - HTML string to escape
   * @returns {string} Escaped HTML
   */
  function escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
  
  /**
   * Scroll chat to bottom
   * @param {boolean} smooth - Whether to use smooth scrolling
   */
  function scrollToBottom(smooth = true) {
    chatMessages.scrollTo({
      top: chatMessages.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
  
  /**
   * Format time for message timestamps
   * @param {Date} date - Date object
   * @returns {string} Formatted time string
   */
  function formatTime(date) {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
  
  /**
   * Clear the chat interface
   */
  function clearChat() {
    // Clear messages
    chatMessages.innerHTML = '';
    state.messages = [];
    
    // Callback for clearing chat
    if (options.onClearChat) {
      options.onClearChat();
    }
  }
  
  /**
   * Show the search results panel
   * @param {boolean} show - Whether to show the panel
   */
  function toggleDetailsPanel(show) {
    if (detailsPanel) {
      detailsPanel.style.display = show ? 'flex' : 'none';
    }
  }
  
  /**
   * Set the focus to the chat input
   */
  function focusInput() {
    chatInput.focus();
  }
  
  /**
   * Get the current chat messages
   * @returns {Array} Chat messages
   */
  function getMessages() {
    return [...state.messages];
  }
  
  // Return public API
  return {
    addMessage: addMessageToChat,
    addSystemMessage,
    addAssistantMessage,
    clearChat,
    toggleDetailsPanel,
    focusInput,
    scrollToBottom,
    getMessages
  };
}