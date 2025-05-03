/**
 * Voice Controls Module
 * 
 * Handles voice input UI and interactions, coordinating with the Voice Service.
 */

import { VoiceService } from '../services/voice-service.js';

/**
 * Initialize voice controls
 * @param {Object} options - Configuration options
 * @returns {Object} Voice controls methods
 */
export function initVoiceControls(options = {}) {
  // Elements
  const voiceButton = document.getElementById('voiceButton');
  const voiceFeedback = document.getElementById('voiceFeedback');
  const voiceText = document.getElementById('voiceText');
  const voiceCancelButton = document.getElementById('voiceCancelButton');
  const voiceVisualizer = voiceFeedback?.querySelector('.voice-feedback__visualizer');
  
  // State
  const state = {
    isListening: false,
    visualizerAnimationFrames: [],
    voiceService: null
  };
  
  /**
   * Initialize voice controls
   */
  function init() {
    // Create voice service
    state.voiceService = new VoiceService(true);
    
    // Set up event handlers
    setupEventListeners();
    
    // Check browser support
    checkSupportAndUpdateUI();
  }
  
  /**
   * Set up event listeners for voice UI elements
   */
  function setupEventListeners() {
    if (voiceButton) {
      voiceButton.addEventListener('click', toggleVoiceInput);
    }
    
    if (voiceCancelButton) {
      voiceCancelButton.addEventListener('click', stopListening);
    }
    
    // Set up keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Space bar while holding Alt to start voice
      if (e.key === ' ' && e.altKey && !state.isListening) {
        e.preventDefault();
        startListening();
      }
      
      // Escape to cancel
      if (e.key === 'Escape' && state.isListening) {
        e.preventDefault();
        stopListening();
      }
    });
  }
  
  /**
   * Check if browser supports speech recognition and update UI accordingly
   */
  function checkSupportAndUpdateUI() {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    
    if (!supported && voiceButton) {
      voiceButton.disabled = true;
      voiceButton.title = 'Voice input not supported in this browser';
      voiceButton.classList.add('voice-unsupported');
    }
  }
  
  /**
   * Toggle voice input on/off
   */
  function toggleVoiceInput() {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }
  
  /**
   * Start voice recognition
   */
  function startListening() {
    if (state.isListening) return;
    
    state.isListening = true;
    
    // Show voice feedback UI
    if (voiceFeedback) {
      voiceFeedback.classList.remove('hidden');
      voiceText.textContent = 'Listening...';
    }
    
    // Start voice recognition
    state.voiceService.startListening(
      handleVoiceResult,
      handleVoiceStart,
      handleVoiceEnd,
      handleVoiceError
    );
    
    // Start visualizer animation
    startVisualizerAnimation();
    
    // Call onVoiceStart callback if provided
    if (typeof options.onVoiceStart === 'function') {
      options.onVoiceStart();
    }
  }
  
  /**
   * Stop voice recognition
   */
  function stopListening() {
    if (!state.isListening) return;
    
    state.isListening = false;
    
    // Hide voice feedback UI
    if (voiceFeedback) {
      voiceFeedback.classList.add('hidden');
    }
    
    // Stop voice recognition
    state.voiceService.stopListening();
    
    // Stop visualizer animation
    stopVisualizerAnimation();
    
    // Call onVoiceEnd callback if provided
    if (typeof options.onVoiceEnd === 'function') {
      options.onVoiceEnd();
    }
  }
  
  /**
   * Handle voice recognition result
   * @param {string} transcript - Voice transcript
   * @param {boolean} isFinal - Whether this is a final result
   */
  function handleVoiceResult(transcript, isFinal) {
    // Update voice text
    if (voiceText) {
      voiceText.textContent = transcript || 'Listening...';
    }
    
    // Call onVoiceInput callback if provided
    if (typeof options.onVoiceInput === 'function') {
      options.onVoiceInput(transcript, isFinal);
    }
    
    // If final result, stop listening if not in continuous mode
    if (isFinal) {
      stopListening();
    }
  }
  
  /**
   * Handle voice recognition start
   */
  function handleVoiceStart() {
    console.log('Voice recognition started');
  }
  
  /**
   * Handle voice recognition end
   */
  function handleVoiceEnd() {
    console.log('Voice recognition ended');
    stopListening();
  }
  
  /**
   * Handle voice recognition error
   * @param {Error} error - Voice recognition error
   */
  function handleVoiceError(error) {
    console.error('Voice recognition error:', error);
    
    // Show error in voice text
    if (voiceText) {
      voiceText.textContent = `Error: ${error.message || 'Could not recognize speech'}`;
    }
    
    // Call onVoiceError callback if provided
    if (typeof options.onVoiceError === 'function') {
      options.onVoiceError(error);
    }
    
    // Stop listening after a delay
    setTimeout(stopListening, 2000);
  }
  
  /**
   * Start visualizer animation
   */
  function startVisualizerAnimation() {
    if (!voiceVisualizer) return;
    
    const bars = voiceVisualizer.querySelectorAll('.voice-feedback__bar');
    
    // Clear any existing animations
    stopVisualizerAnimation();
    
    // Animate each bar
    bars.forEach((bar, index) => {
      const animateBar = () => {
        const randomHeight = Math.floor(Math.random() * 20) + 5;
        bar.style.height = `${randomHeight}px`;
        
        // Schedule next frame with varying time for more natural look
        const frameTime = 150 + (index * 50) + (Math.random() * 100);
        const requestId = setTimeout(animateBar, frameTime);
        state.visualizerAnimationFrames.push(requestId);
      };
      
      // Start animation with staggered delay
      const initialDelay = index * 100;
      const requestId = setTimeout(animateBar, initialDelay);
      state.visualizerAnimationFrames.push(requestId);
    });
  }
  
  /**
   * Stop visualizer animation
   */
  function stopVisualizerAnimation() {
    // Clear all animation frames
    state.visualizerAnimationFrames.forEach(id => clearTimeout(id));
    state.visualizerAnimationFrames = [];
    
    // Reset bar heights
    if (voiceVisualizer) {
      const bars = voiceVisualizer.querySelectorAll('.voice-feedback__bar');
      bars.forEach(bar => {
        bar.style.height = '5px';
      });
    }
  }
  
  /**
   * Check if voice input is supported
   * @returns {boolean} Whether voice input is supported
   */
  function isSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }
  
  /**
   * Check if currently listening
   * @returns {boolean} Whether currently listening
   */
  function isActive() {
    return state.isListening;
  }
  
  // Initialize on creation
  init();
  
  // Return public API
  return {
    startListening,
    stopListening,
    isActive,
    isSupported
  };
} 