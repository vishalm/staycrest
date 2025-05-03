// js/config/voice-config.js

/**
 * Voice Configuration for Speech Recognition and Text-to-Speech
 * Supports multiple providers including browser native, Ollama, Play.ai, and others
 */

export const VOICE_CONFIG = {
    defaultProvider: process.env.VOICE_PROVIDER || 'browser',
    
    // Voice Recognition Settings
    recognition: {
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      lang: 'en-US',
      autoStop: 5000, // Stop listening after 5 seconds of silence
      hotword: 'hey staycrest', // Wake word
    },
    
    // Text-to-Speech Providers
    providers: {
      browser: {
        name: 'Browser Native',
        type: 'built-in',
        enabled: true,
        settings: {
          rate: 1.0,
          pitch: 1.0,
          volume: 1.0,
          voice: null, // Auto-select best voice
        },
        limitations: [
          'Limited voice options',
          'Quality varies by browser',
          'No customization'
        ]
      },
      
      ollama: {
        name: 'Ollama Local TTS',
        type: 'local',
        enabled: false,
        baseUrl: process.env.OLLAMA_TTS_URL || 'http://localhost:11434',
        models: {
          coqui: {
            name: 'Coqui TTS',
            endpoint: '/api/tts/coqui',
            quality: 'high',
            speed: 'fast',
            languages: ['en', 'es', 'fr', 'de']
          },
          tortoise: {
            name: 'Tortoise TTS',
            endpoint: '/api/tts/tortoise',
            quality: 'ultra-high',
            speed: 'slow',
            languages: ['en']
          },
          bark: {
            name: 'Bark TTS',
            endpoint: '/api/tts/bark',
            quality: 'high',
            speed: 'medium',
            languages: ['en', 'es', 'fr', 'zh', 'ja']
          }
        },
        defaultModel: 'coqui',
        settings: {
          model: 'coqui',
          voice: 'default',
          quality: 'high',
          rate: 'normal'
        }
      },
      
      playai: {
        name: 'Play.ai',
        type: 'cloud',
        enabled: false,
        apiKey: process.env.PLAYAI_API_KEY,
        apiUrl: 'https://api.play.ai/v1',
        models: {
          casual: {
            name: 'Casual Conversation',
            modelId: 'play-casual-v1',
            emotions: ['friendly', 'cheerful', 'enthusiastic'],
            suitable_for: ['general chat', 'customer service']
          },
          professional: {
            name: 'Professional',
            modelId: 'play-professional-v1',
            emotions: ['neutral', 'authoritative', 'informative'],
            suitable_for: ['business', 'education', 'formal']
          },
          storyteller: {
            name: 'Storyteller',
            modelId: 'play-storyteller-v1',
            emotions: ['dramatic', 'engaging', 'expressive'],
            suitable_for: ['narratives', 'descriptions', 'entertainment']
          }
        },
        defaultModel: 'casual',
        settings: {
          voice: 'en-US-casual-female',
          emotion: 'friendly',
          rate: 'normal',
          stability: 0.5,
          similarityBoost: 0.5
        }
      },
      
      elevenlabs: {
        name: 'ElevenLabs',
        type: 'cloud',
        enabled: false,
        apiKey: process.env.ELEVENLABS_API_KEY,
        apiUrl: 'https://api.elevenlabs.io/v1',
        settings: {
          voice_id: 'default',
          model_id: 'eleven_monolingual_v1',
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0,
          use_speaker_boost: true
        },
        voices: {
          rachel: 'Rachel - Natural & Conversational',
          domi: 'Domi - Calm & Professional',
          bella: 'Bella - Upbeat & Friendly'
        }
      },
      
      openai: {
        name: 'OpenAI TTS',
        type: 'cloud',
        enabled: false,
        apiKey: process.env.OPENAI_API_KEY,
        apiUrl: 'https://api.openai.com/v1/audio/speech',
        models: {
          default: 'tts-1',
          hd: 'tts-1-hd'
        },
        voices: {
          alloy: 'Alloy - Balanced & Natural',
          echo: 'Echo - Clear & Professional',
          fable: 'Fable - Warm & Expressive',
          onyx: 'Onyx - Deep & Authoritative',
          nova: 'Nova - Friendly & Engaging',
          shimmer: 'Shimmer - Light & Pleasant'
        },
        settings: {
          model: 'tts-1',
          voice: 'nova',
          response_format: 'mp3',
          speed: 1.0
        }
      }
    },
    
    // Voice Commands
    commands: {
      navigation: {
        'show settings': () => document.getElementById('settings-modal').classList.remove('hidden'),
        'open voice settings': () => document.getElementById('voice-modal').classList.remove('hidden'),
        'close': () => {
          document.querySelector('.modal:not(.hidden)')?.classList.add('hidden');
        },
        'change theme': () => document.getElementById('theme-toggle').click(),
        'clear chat': () => document.getElementById('chat-messages').innerHTML = '',
      },
      
      search: {
        'find': (query) => performSearch(query),
        'search for': (query) => performSearch(query),
        'show me': (query) => performSearch(query),
        'compare': (query) => performComparison(query),
      },
      
      interaction: {
        'repeat': () => repeatLastResponse(),
        'speak slower': () => adjustSpeechRate(-0.2),
        'speak faster': () => adjustSpeechRate(0.2),
        'stop speaking': () => window.speechSynthesis.cancel(),
        'read that again': () => repeatLastResponse(),
      }
    },
    
    // Multilingual Support
    languages: {
      'en-US': { name: 'English (US)', code: 'en-US', wavenet: true },
      'en-GB': { name: 'English (UK)', code: 'en-GB', wavenet: true },
      'es-ES': { name: 'Spanish', code: 'es-ES', wavenet: true },
      'fr-FR': { name: 'French', code: 'fr-FR', wavenet: true },
      'de-DE': { name: 'German', code: 'de-DE', wavenet: true },
      'it-IT': { name: 'Italian', code: 'it-IT', wavenet: true },
      'ja-JP': { name: 'Japanese', code: 'ja-JP', wavenet: true },
      'ko-KR': { name: 'Korean', code: 'ko-KR', wavenet: true },
      'zh-CN': { name: 'Chinese (Mandarin)', code: 'zh-CN', wavenet: true },
      'ar-AE': { name: 'Arabic (UAE)', code: 'ar-AE', wavenet: false },
      'hi-IN': { name: 'Hindi', code: 'hi-IN', wavenet: false },
    },
    
    // Audio Settings
    audio: {
      inputDevice: 'default',
      inputGain: 1.0,
      noiseReduction: true,
      echoCancellation: true,
      autoGainControl: true,
      sampleRate: 16000,
      channels: 1
    },
    
    // Feature Flags
    features: {
      wakeWord: true,
      continuousListening: true,
      voiceCommands: true,
      emotionRecognition: false,
      multiSpeakerDetection: false,
      languageAutoDetect: true,
      backgroundNoiseAdaptation: true,
      voiceFeedback: true,
      visualFeedback: true
    },
    
    // Privacy Settings
    privacy: {
      storeAudioLocally: false,
      shareAudioWithProvider: false,
      anonymizeTranscripts: true,
      deleteAfterSession: true,
      requireUserPermission: true
    }
  };
  
  /**
   * Initialize voice provider
   */
  export async function initializeVoiceProvider(providerName) {
    const provider = VOICE_CONFIG.providers[providerName];
    
    if (!provider) {
      throw new Error(`Voice provider ${providerName} not found`);
    }
    
    if (provider.type === 'cloud' && !provider.apiKey) {
      throw new Error(`API key required for ${providerName}`);
    }
    
    // For browser provider, check support
    if (providerName === 'browser') {
      return await checkBrowserSupport();
    }
    
    // For cloud providers, verify API key
    if (provider.type === 'cloud') {
      return await verifyCloudProvider(providerName);
    }
    
    // For local Ollama, check connection
    if (providerName === 'ollama') {
      return await checkOllamaConnection();
    }
    
    return true;
  }
  
  /**
   * Check browser support for speech features
   */
  async function checkBrowserSupport() {
    const recognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const synthesis = 'speechSynthesis' in window;
    
    return {
      supported: recognition && synthesis,
      recognition,
      synthesis,
      voices: synthesis ? speechSynthesis.getVoices() : []
    };
  }
  
  /**
   * Verify cloud provider connection
   */
  async function verifyCloudProvider(providerName) {
    const provider = VOICE_CONFIG.providers[providerName];
    
    try {
      // Perform a test API call to verify connection
      const response = await fetch(provider.apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Failed to verify ${providerName}:`, error);
      return false;
    }
  }
  
  /**
   * Check Ollama connection
   */
  async function checkOllamaConnection() {
    try {
      const response = await fetch(`${VOICE_CONFIG.providers.ollama.baseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Failed to connect to Ollama:', error);
      return false;
    }
  }
  
  /**
   * Update voice settings
   */
  export function updateVoiceSettings(providerName, settings) {
    if (!VOICE_CONFIG.providers[providerName]) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    VOICE_CONFIG.providers[providerName].settings = {
      ...VOICE_CONFIG.providers[providerName].settings,
      ...settings
    };
    
    // Save to localStorage
    localStorage.setItem('voice-config', JSON.stringify(VOICE_CONFIG));
  }
  
  /**
   * Get voice provider
   */
  export function getVoiceProvider(providerName = VOICE_CONFIG.defaultProvider) {
    return VOICE_CONFIG.providers[providerName];
  }
  
  /**
   * Switch voice provider
   */
  export async function switchVoiceProvider(providerName) {
    const isAvailable = await initializeVoiceProvider(providerName);
    
    if (isAvailable) {
      VOICE_CONFIG.defaultProvider = providerName;
      VOICE_CONFIG.providers[providerName].enabled = true;
      
      // Disable others
      Object.keys(VOICE_CONFIG.providers).forEach(key => {
        if (key !== providerName) {
          VOICE_CONFIG.providers[key].enabled = false;
        }
      });
      
      return true;
    }
    
    return false;
  }