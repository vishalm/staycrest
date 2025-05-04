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
  async function init() {
    try {
      // Create voice service
      state.voiceService = new VoiceService(true, {
        continuous: false,
        autoSubmit: true,
        language: 'en-US'
      });
      
      // Set up event handlers
      setupEventListeners();
      
      // Check browser support and update UI
      await checkSupportAndUpdateUI();
    } catch (error) {
      console.error('Error initializing voice controls:', error);
      updateButtonState('error');
    }
  }
  
  /**
   * Set up event listeners for voice UI elements
   */
  function setupEventListeners() {
    if (voiceButton) {
      voiceButton.addEventListener('click', handleVoiceButtonClick);
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
  async function checkSupportAndUpdateUI() {
    try {
      const supported = state.voiceService.checkBrowserSupport();
      
      if (!supported && voiceButton) {
        voiceButton.disabled = true;
        voiceButton.title = 'Voice input not supported in this browser';
        voiceButton.classList.add('voice-unsupported');
        return false;
      }
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      
      updateButtonState('ready');
      return true;
    } catch (error) {
      console.error('Error checking voice support:', error);
      updateButtonState('error');
      return false;
    }
  }
  
  /**
   * Handle voice button click
   */
  async function handleVoiceButtonClick() {
    try {
      if (state.isListening) {
        await stopListening();
      } else {
        await startListening();
      }
    } catch (error) {
      console.error('Error handling voice button click:', error);
      updateButtonState('error');
    }
  }
  
  /**
   * Start voice recognition
   */
  async function startListening() {
    if (state.isListening) return;
    
    try {
      updateButtonState('starting');
      
      const started = await state.voiceService.startListening(
        handleVoiceResult,
        handleVoiceStart,
        handleVoiceEnd,
        handleVoiceError
      );
      
      if (started) {
        state.isListening = true;
        updateButtonState('listening');
        showVoiceFeedback();
        startVisualizerAnimation();
        
        // Call onVoiceStart callback if provided
        if (typeof options.onVoiceStart === 'function') {
          options.onVoiceStart();
        }
      } else {
        throw new Error('Failed to start voice recognition');
      }
    } catch (error) {
      console.error('Error starting voice recognition:', error);
      updateButtonState('error');
      handleVoiceError(error);
    }
  }
  
  /**
   * Stop voice recognition
   */
  async function stopListening() {
    if (!state.isListening) return;
    
    try {
      state.isListening = false;
      state.voiceService.stopListening();
      
      updateButtonState('ready');
      hideVoiceFeedback();
      stopVisualizerAnimation();
      
      // Call onVoiceEnd callback if provided
      if (typeof options.onVoiceEnd === 'function') {
        options.onVoiceEnd();
      }
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
      updateButtonState('error');
    }
  }
  
  /**
   * Update voice button state and appearance
   * @param {'ready'|'starting'|'listening'|'error'} state - Button state
   */
  function updateButtonState(state) {
    if (!voiceButton) return;
    
    // Remove all state classes
    voiceButton.classList.remove(
      'voice-ready',
      'voice-starting',
      'voice-listening',
      'voice-error'
    );
    
    // Add appropriate state class
    voiceButton.classList.add(`voice-${state}`);
    
    // Update button text/icon based on state
    switch (state) {
      case 'ready':
        voiceButton.title = 'Start voice input';
        voiceButton.disabled = false;
        break;
      case 'starting':
        voiceButton.title = 'Starting voice input...';
        voiceButton.disabled = true;
        break;
      case 'listening':
        voiceButton.title = 'Stop voice input';
        voiceButton.disabled = false;
        break;
      case 'error':
        voiceButton.title = 'Voice input error';
        voiceButton.disabled = true;
        break;
    }
  }
  
  /**
   * Show voice feedback UI
   */
  function showVoiceFeedback() {
    if (voiceFeedback) {
      voiceFeedback.classList.remove('hidden');
      voiceText.textContent = 'Listening...';
    }
  }
  
  /**
   * Hide voice feedback UI
   */
  function hideVoiceFeedback() {
    if (voiceFeedback) {
      voiceFeedback.classList.add('hidden');
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