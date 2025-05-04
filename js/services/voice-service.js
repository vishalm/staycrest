// js/services/voice-service.js

import { VOICE_CONFIG, getVoiceProvider, initializeVoiceProvider } from '../config/voice-config.js';

/**
 * Voice Service
 * 
 * Handles speech recognition and text-to-speech functionality for the StayCrest application.
 * Supports multiple voice providers and configuration options.
 */
export class VoiceService {
  /**
   * Initialize the Voice Service
   * @param {boolean} enabled - Whether voice functionality is enabled
   * @param {Object} options - Configuration options
   */
  constructor(enabled = true, options = {}) {
    this.enabled = enabled;
    this.options = {
      provider: 'browser',
      language: 'en-US',
      continuous: false,
      autoSubmit: true,
      voiceSpeed: 1,
      voicePitch: 1,
      voiceVolume: 1,
      ...options
    };
    
    // State
    this.isInitialized = false;
    this.isListening = false;
    this.hasPermission = false;
    
    // Initialize speech recognition if available
    this.recognition = null;
    this.initSpeechRecognition();
    
    // Set up speech synthesis
    this.synthesis = window.speechSynthesis;
    this.speaking = false;
    
    // Event callbacks
    this.onStart = null;
    this.onEnd = null;
    this.onResult = null;
    this.onError = null;
  }
  
  /**
   * Check if browser supports speech recognition
   * @returns {boolean} Whether speech recognition is supported
   */
  checkBrowserSupport() {
    const recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const synthesis = 'speechSynthesis' in window;
    
    this.recognitionSupported = !!recognition;
    this.synthesisSupported = synthesis;
    
    return this.recognitionSupported && this.synthesisSupported;
  }
  
  /**
   * Initialize speech recognition
   */
  async initSpeechRecognition() {
    if (this.isInitialized || !this.enabled) return;
    
    // Check browser support
    if (!this.checkBrowserSupport()) {
      console.error('Speech recognition not supported in this browser');
      return;
    }
    
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.hasPermission = true;
      
      // Stop the stream immediately as we only needed it for permission
      stream.getTracks().forEach(track => track.stop());
      
      // Initialize speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      // Configure recognition
      this.recognition.lang = this.options.language;
      this.recognition.continuous = this.options.continuous;
      this.recognition.interimResults = true;
      
      // Set up event handlers
      this.recognition.onstart = this.handleRecognitionStart.bind(this);
      this.recognition.onend = this.handleRecognitionEnd.bind(this);
      this.recognition.onresult = this.handleRecognitionResult.bind(this);
      this.recognition.onerror = this.handleRecognitionError.bind(this);
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error initializing speech recognition:', error);
      this.hasPermission = false;
      throw error;
    }
  }
  
  /**
   * Start speech recognition
   * @param {Function} onResult - Callback for recognition results
   * @param {Function} onStart - Callback for recognition start
   * @param {Function} onEnd - Callback for recognition end
   * @param {Function} onError - Callback for recognition errors
   * @returns {Promise<boolean>} Whether recognition was started successfully
   */
  async startListening(onResult, onStart, onEnd, onError) {
    if (!this.enabled) {
      if (onError) onError(new Error('Voice service is not enabled'));
      return false;
    }
    
    try {
      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initSpeechRecognition();
      }
      
      if (!this.recognition || !this.hasPermission) {
        throw new Error('Speech recognition not initialized or permission denied');
      }
      
      // Set callback functions
      this.onResult = onResult;
      this.onStart = onStart;
      this.onEnd = onEnd;
      this.onError = onError;
      
      // Start recognition
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      if (onError) onError(error);
      return false;
    }
  }
  
  /**
   * Stop speech recognition
   */
  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }
  
  /**
   * Handle recognition start event
   * @param {Event} event - Recognition start event
   */
  handleRecognitionStart(event) {
    this.isListening = true;
    console.log('Speech recognition started');
    if (this.onStart) this.onStart(event);
  }
  
  /**
   * Handle recognition end event
   * @param {Event} event - Recognition end event
   */
  handleRecognitionEnd(event) {
    this.isListening = false;
    console.log('Speech recognition ended');
    if (this.onEnd) this.onEnd(event);
  }
  
  /**
   * Handle recognition result event
   * @param {Event} event - Recognition result event
   */
  handleRecognitionResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }
    
    // If we have a final transcript and auto-submit is enabled
    if (finalTranscript && this.options.autoSubmit) {
      if (this.onResult) this.onResult(finalTranscript, true);
    } else if (interimTranscript) {
      // Otherwise, process interim transcript
      if (this.onResult) this.onResult(interimTranscript, false);
    }
  }
  
  /**
   * Handle recognition error event
   * @param {Event} event - Recognition error event
   */
  handleRecognitionError(event) {
    this.isListening = false;
    console.error('Speech recognition error:', event.error);
    
    if (this.onError) {
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'not-allowed':
          errorMessage = 'Microphone access denied';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected';
          break;
        case 'network':
          errorMessage = 'Network error occurred';
          break;
        case 'aborted':
          errorMessage = 'Recognition was aborted';
          break;
        default:
          errorMessage = `Recognition error: ${event.error}`;
      }
      
      this.onError(new Error(errorMessage));
    }
  }
  
  /**
   * Speak text using the selected provider
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    if (!this.enabled || !text) return;
    
    const speechOptions = {
      provider: this.options.provider,
      rate: this.options.voiceSpeed,
      pitch: this.options.voicePitch,
      volume: this.options.voiceVolume,
      ...options
    };
    
    // Cancel any current speech
    this.stopSpeaking();
    
    try {
      switch (speechOptions.provider) {
        case 'browser':
          this.speakWithBrowser(text, speechOptions);
          break;
        case 'ollama':
          await this.speakWithOllama(text, speechOptions);
          break;
        case 'playai':
          await this.speakWithPlayAI(text, speechOptions);
          break;
        case 'elevenlabs':
          await this.speakWithElevenLabs(text, speechOptions);
          break;
        default:
          this.speakWithBrowser(text, speechOptions);
      }
    } catch (error) {
      console.error('Error speaking text:', error);
      // Fall back to browser speech if other provider fails
      if (speechOptions.provider !== 'browser') {
        this.speakWithBrowser(text, speechOptions);
      }
    }
  }
  
  /**
   * Stop any ongoing speech
   */
  stopSpeaking() {
    if (this.synthesisSupported) {
      this.synthesis.cancel();
    }
    
    // Also stop any custom audio playback
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    this.speaking = false;
  }
  
  /**
   * Speak text using browser's built-in speech synthesis
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   */
  speakWithBrowser(text, options) {
    if (!this.synthesisSupported) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || 1;
    utterance.pitch = options.pitch || 1;
    utterance.volume = options.volume || 1;
    utterance.lang = options.language || this.options.language;
    
    // Optional voice selection
    if (options.voice) {
      const voices = this.synthesis.getVoices();
      const selectedVoice = voices.find(voice => 
        voice.name === options.voice || voice.voiceURI === options.voice
      );
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
    
    // Set event handlers
    utterance.onstart = () => {
      this.speaking = true;
      console.log('Speech started');
    };
    
    utterance.onend = () => {
      this.speaking = false;
      console.log('Speech ended');
    };
    
    utterance.onerror = (event) => {
      this.speaking = false;
      console.error('Speech error:', event);
    };
    
    // Start speaking
    this.synthesis.speak(utterance);
  }
  
  /**
   * Speak text using Ollama TTS
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   * @returns {Promise<void>}
   */
  async speakWithOllama(text, options) {
    // This is a placeholder for integration with Ollama TTS
    // Actual implementation would involve API calls to an Ollama server
    console.log('Speaking with Ollama:', text);
    
    // Placeholder: fall back to browser TTS
    this.speakWithBrowser(text, options);
  }
  
  /**
   * Speak text using Play.ai
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   * @returns {Promise<void>}
   */
  async speakWithPlayAI(text, options) {
    // This is a placeholder for integration with Play.ai
    console.log('Speaking with Play.ai:', text);
    
    // Example implementation (API details would vary)
    try {
      const apiKey = localStorage.getItem('playai_api_key');
      
      if (!apiKey) {
        throw new Error('Play.ai API key not found');
      }
      
      const response = await fetch('https://api.play.ai/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          text,
          voice: options.voice || 'default',
          speed: options.rate || 1
        })
      });
      
      if (!response.ok) {
        throw new Error(`Play.ai API error: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      this.audioElement = new Audio(audioUrl);
      this.audioElement.volume = options.volume || 1;
      
      this.audioElement.onplay = () => {
        this.speaking = true;
        console.log('Play.ai speech started');
      };
      
      this.audioElement.onended = () => {
        this.speaking = false;
        console.log('Play.ai speech ended');
        URL.revokeObjectURL(audioUrl);
      };
      
      this.audioElement.onerror = (error) => {
        this.speaking = false;
        console.error('Play.ai speech error:', error);
        URL.revokeObjectURL(audioUrl);
      };
      
      await this.audioElement.play();
    } catch (error) {
      console.error('Error with Play.ai TTS:', error);
      // Fall back to browser TTS
      this.speakWithBrowser(text, options);
    }
  }
  
  /**
   * Speak text using ElevenLabs
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   * @returns {Promise<void>}
   */
  async speakWithElevenLabs(text, options) {
    // This is a placeholder for integration with ElevenLabs
    console.log('Speaking with ElevenLabs:', text);
    
    // Example implementation (API details would vary)
    try {
      const apiKey = localStorage.getItem('elevenlabs_api_key');
      
      if (!apiKey) {
        throw new Error('ElevenLabs API key not found');
      }
      
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          voice_id: options.voice || 'default',
          model_id: 'eleven_monolingual_v1'
        })
      });
      
      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      this.audioElement = new Audio(audioUrl);
      this.audioElement.volume = options.volume || 1;
      
      this.audioElement.onplay = () => {
        this.speaking = true;
        console.log('ElevenLabs speech started');
      };
      
      this.audioElement.onended = () => {
        this.speaking = false;
        console.log('ElevenLabs speech ended');
        URL.revokeObjectURL(audioUrl);
      };
      
      this.audioElement.onerror = (error) => {
        this.speaking = false;
        console.error('ElevenLabs speech error:', error);
        URL.revokeObjectURL(audioUrl);
      };
      
      await this.audioElement.play();
    } catch (error) {
      console.error('Error with ElevenLabs TTS:', error);
      // Fall back to browser TTS
      this.speakWithBrowser(text, options);
    }
  }
  
  /**
   * Get all available voices for the browser's speech synthesis
   * @returns {Array} List of available voices
   */
  getVoices() {
    if (!this.synthesisSupported) return [];
    
    return this.synthesis.getVoices();
  }
  
  /**
   * Update voice service configuration
   * @param {Object} options - New configuration options
   */
  updateConfig(options) {
    this.options = { ...this.options, ...options };
    
    // Reinitialize speech recognition with new options
    if (this.recognition) {
      this.recognition.lang = this.options.language;
      this.recognition.continuous = this.options.continuous;
    }
    
    // Update enabled state
    this.enabled = options.enabled !== undefined ? options.enabled : this.enabled;
  }
  
  /**
   * Check if speech recognition is currently active
   * @returns {boolean} Whether speech recognition is active
   */
  isListening() {
    return this.recognition !== null && this.enabled;
  }
  
  /**
   * Check if text-to-speech is currently active
   * @returns {boolean} Whether text-to-speech is active
   */
  isSpeaking() {
    return this.speaking;
  }
}

// Export singleton instance
export const voiceService = new VoiceService();