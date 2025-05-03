// js/config/llm-config.js

/**
 * LLM Provider Configuration
 * Supports multiple AI providers including local Ollama and cloud-based models
 */

export const LLM_CONFIG = {
    defaultProvider: process.env.LLM_PROVIDER || 'ollama',
    
    providers: {
      ollama: {
        name: 'Ollama (Local)',
        type: 'local',
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        defaultModel: process.env.OLLAMA_MODEL || 'llama2',
        availableModels: [
          'llama2',
          'llama3',
          'codellama',
          'mistral',
          'vicuna',
          'llama2-chinese',
          'orca-mini'
        ],
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          max_tokens: 1000,
          stream: true
        },
        endpoints: {
          chat: '/api/chat',
          generate: '/api/generate',
          embeddings: '/api/embeddings'
        }
      },
      
      openai: {
        name: 'OpenAI',
        type: 'cloud',
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        availableModels: [
          'gpt-3.5-turbo',
          'gpt-3.5-turbo-16k',
          'gpt-4',
          'gpt-4-32k',
          'gpt-4-turbo-preview'
        ],
        options: {
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: true
        }
      },
      
      claude: {
        name: 'Anthropic Claude',
        type: 'cloud',
        apiKey: process.env.CLAUDE_API_KEY,
        baseUrl: 'https://api.anthropic.com/v1',
        defaultModel: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
        availableModels: [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307',
          'claude-2.1',
          'claude-2.0',
          'claude-instant-1.2'
        ],
        options: {
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9,
          top_k: 40,
          stream: true
        }
      },
      
      gemini: {
        name: 'Google Gemini',
        type: 'cloud',
        apiKey: process.env.GEMINI_API_KEY,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        defaultModel: process.env.GEMINI_MODEL || 'gemini-pro',
        availableModels: [
          'gemini-pro',
          'gemini-pro-vision',
          'gemini-ultra'
        ],
        options: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 1000
        }
      },
      
      cohere: {
        name: 'Cohere',
        type: 'cloud',
        apiKey: process.env.COHERE_API_KEY,
        baseUrl: 'https://api.cohere.ai/v1',
        defaultModel: process.env.COHERE_MODEL || 'command',
        availableModels: [
          'command',
          'command-nightly',
          'command-light',
          'command-light-nightly'
        ],
        options: {
          temperature: 0.7,
          max_tokens: 1000,
          k: 40,
          p: 0.9,
          stop_sequences: [],
          return_likelihoods: 'NONE'
        }
      },
      
      together: {
        name: 'Together AI',
        type: 'cloud',
        apiKey: process.env.TOGETHER_API_KEY,
        baseUrl: 'https://api.together.xyz/v1',
        defaultModel: process.env.TOGETHER_MODEL || 'togethercomputer/RedPajama-INCITE-Chat-3B-v1',
        availableModels: [
          'togethercomputer/RedPajama-INCITE-Chat-3B-v1',
          'togethercomputer/RedPajama-INCITE-7B-Chat',
          'meta-llama/Llama-2-7b-chat-hf',
          'meta-llama/Llama-2-13b-chat-hf',
          'mistralai/Mixtral-8x7B-Instruct-v0.1'
        ],
        options: {
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.9,
          top_k: 40,
          repetition_penalty: 1.1,
          stop: ['</s>', '[INST]', '[/INST]']
        }
      }
    },
    
    // System prompt for hotel search context
    systemPrompt: `You are a helpful hotel discovery assistant for StayCrest. 
      You help users find and explore hotel loyalty programs and accommodations.
      
      Your capabilities include:
      - Searching across multiple hotel loyalty programs
      - Comparing hotel brands and their benefits
      - Finding specific types of accommodations
      - Providing detailed information about hotel programs
      - Making personalized recommendations based on user preferences
      
      Always provide helpful, accurate information about hotels and their loyalty programs.
      If you can't find specific information, suggest alternative options.`,
    
    // Chat settings
    chatSettings: {
      maxHistory: 10,
      contextWindow: 4000,
      responseTimeout: 30000,
      streamResponses: true,
      saveHistory: true,
      autoRetry: 3,
      retryDelay: 1000
    },
    
    // Feature flags
    features: {
      embeddings: false,
      imageGeneration: false,
      voiceInput: false,
      voiceOutput: false,
      multimodal: false,
      functionCalling: true
    }
  };
  
  /**
   * Get active LLM provider configuration
   */
  export function getActiveProvider() {
    const provider = LLM_CONFIG.defaultProvider;
    return LLM_CONFIG.providers[provider];
  }
  
  /**
   * Validate provider configuration
   */
  export function validateProviderConfig(providerName) {
    const provider = LLM_CONFIG.providers[providerName];
    
    if (!provider) {
      throw new Error(`Invalid provider: ${providerName}`);
    }
    
    // Validate required fields based on provider type
    if (provider.type === 'cloud' && !provider.apiKey) {
      throw new Error(`API key required for ${providerName}`);
    }
    
    if (provider.type === 'local' && !provider.baseUrl) {
      throw new Error(`Base URL required for ${providerName}`);
    }
    
    return true;
  }
  
  /**
   * Update provider configuration at runtime
   */
  export function updateProviderConfig(providerName, updates) {
    if (!LLM_CONFIG.providers[providerName]) {
      throw new Error(`Provider ${providerName} not found`);
    }
    
    LLM_CONFIG.providers[providerName] = {
      ...LLM_CONFIG.providers[providerName],
      ...updates
    };
    
    // Save to localStorage for persistence
    try {
      localStorage.setItem('llm-config', JSON.stringify(LLM_CONFIG));
    } catch (error) {
      console.error('Failed to save LLM config:', error);
    }
  }
  
  /**
   * Load saved configuration from localStorage
   */
  export function loadSavedConfig() {
    try {
      const savedConfig = localStorage.getItem('llm-config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        // Merge with default config to ensure all fields exist
        Object.keys(parsed.providers).forEach(provider => {
          if (LLM_CONFIG.providers[provider]) {
            LLM_CONFIG.providers[provider] = {
              ...LLM_CONFIG.providers[provider],
              ...parsed.providers[provider]
            };
          }
        });
      }
    } catch (error) {
      console.error('Failed to load saved LLM config:', error);
    }
  }
  
  // Initialize
  loadSavedConfig();