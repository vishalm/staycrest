const { Configuration, OpenAIApi } = require('openai');
const axios = require('axios');
const winston = require('winston');
const analyticsService = require('./analytics-service');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/llm.log' })
  ],
});

/**
 * LLM Provider service to interact with different LLM services
 */
class LLMProvider {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'ollama';
    this.model = process.env.LLM_MODEL || 'llama2';
    this.apiKey = process.env.LLM_API_KEY || '';
    this.baseUrl = process.env.LLM_BASE_URL || 'http://localhost:11434';
    this.initialized = false;
    this.clients = {};
    this.metrics = {
      totalCalls: 0,
      totalTokens: 0,
      averageLatency: 0,
      errors: 0,
      callsByModel: {},
      tokensByModel: {},
    };
    this.fallbackEnabled = process.env.LLM_FALLBACK_ENABLED === 'true';
    this.fallbackProviders = (process.env.LLM_FALLBACK_PROVIDERS || '').split(',').filter(Boolean);
  }
  
  /**
   * Initialize the LLM provider
   */
  async initialize() {
    try {
      switch (this.provider) {
        case 'openai':
          await this.initializeOpenAI();
          break;
        case 'claude':
          await this.initializeClaude();
          break;
        case 'gemini':
          await this.initializeGemini();
          break;
        case 'ollama':
        default:
          await this.initializeOllama();
      }
      
      // Initialize fallback providers if configured
      if (this.fallbackEnabled && this.fallbackProviders.length > 0) {
        await this.initializeFallbackProviders();
      }
      
      this.initialized = true;
      logger.info(`LLM Provider initialized: ${this.provider}`);
      
      // Log to analytics
      analyticsService.trackEvent('llm_initialized', {
        provider: this.provider,
        defaultModel: this.model,
        fallbackEnabled: this.fallbackEnabled
      });
    } catch (error) {
      logger.error(`Failed to initialize LLM provider: ${error.message}`);
      analyticsService.trackError(error, { context: 'LLM initialization', provider: this.provider });
      throw error;
    }
  }
  
  /**
   * Initialize fallback providers
   */
  async initializeFallbackProviders() {
    for (const provider of this.fallbackProviders) {
      if (provider !== this.provider) {
        try {
          switch (provider) {
            case 'openai':
              if (!this.clients.openai) {
                await this.initializeOpenAI();
              }
              break;
            case 'claude':
              if (!this.clients.claude) {
                await this.initializeClaude();
              }
              break;
            case 'gemini':
              if (!this.clients.gemini) {
                await this.initializeGemini();
              }
              break;
            case 'ollama':
              if (!this.clients.ollama) {
                await this.initializeOllama();
              }
              break;
          }
          logger.info(`Fallback provider initialized: ${provider}`);
        } catch (error) {
          logger.warn(`Failed to initialize fallback provider ${provider}: ${error.message}`);
        }
      }
    }
  }
  
  /**
   * Initialize OpenAI client
   */
  async initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY || this.apiKey;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    const configuration = new Configuration({
      apiKey,
    });
    
    this.clients.openai = new OpenAIApi(configuration);
    
    // Verify API key with a simple request
    try {
      await this.clients.openai.listModels();
      return true;
    } catch (error) {
      delete this.clients.openai;
      throw error;
    }
  }
  
  /**
   * Initialize Claude/Anthropic client
   */
  async initializeClaude() {
    const apiKey = process.env.ANTHROPIC_API_KEY || this.apiKey;
    
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    // Claude uses a simple API without a client library
    this.clients.claude = {
      baseURL: 'https://api.anthropic.com',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2025-06-01',
        'content-type': 'application/json',
      }
    };
    
    // Verify API key with a simple request
    try {
      await axios.get(`${this.clients.claude.baseURL}/v1/models`, {
        headers: this.clients.claude.headers
      });
      return true;
    } catch (error) {
      delete this.clients.claude;
      throw error;
    }
  }
  
  /**
   * Initialize Google Gemini client
   */
  async initializeGemini() {
    const apiKey = process.env.GOOGLE_AI_API_KEY || this.apiKey;
    
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }
    
    // Gemini uses a simple API
    this.clients.gemini = {
      baseURL: 'https://generativelanguage.googleapis.com',
      apiKey,
    };
    
    // Verify API key with a simple request
    try {
      await axios.get(`${this.clients.gemini.baseURL}/v1beta/models?key=${this.clients.gemini.apiKey}`);
      return true;
    } catch (error) {
      delete this.clients.gemini;
      throw error;
    }
  }
  
  /**
   * Initialize Ollama client
   */
  async initializeOllama() {
    const baseUrl = process.env.OLLAMA_BASE_URL || this.baseUrl;
    
    // Ollama uses a simple API without auth
    this.clients.ollama = {
      baseURL: baseUrl,
    };
    
    // Check if Ollama server is running
    try {
      await axios.get(`${this.clients.ollama.baseURL}/api/tags`);
      return true;
    } catch (error) {
      logger.warn('Ollama server not available: ', error.message);
      // Don't throw error here to allow the app to run without Ollama
      // But return false to indicate failure
      return false;
    }
  }
  
  /**
   * Generate response from LLM
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Additional options for the API call
   * @returns {Promise<string>} Generated text
   */
  async generateResponse(prompt, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const callOptions = {
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1000,
      model: options.model || this.model,
      ...options
    };
    
    const startTime = Date.now();
    let response, error, provider, tokenUsage;
    
    try {
      // Use specified provider or default
      provider = options.provider || this.provider;
      
      // Check if specified provider is available
      if (options.provider && !this.clients[options.provider.toLowerCase()]) {
        throw new Error(`Specified provider ${options.provider} is not available`);
      }
      
      switch (provider.toLowerCase()) {
        case 'openai':
          [response, tokenUsage] = await this.generateWithOpenAI(prompt, callOptions);
          break;
        case 'claude':
          [response, tokenUsage] = await this.generateWithClaude(prompt, callOptions);
          break;
        case 'gemini':
          [response, tokenUsage] = await this.generateWithGemini(prompt, callOptions);
          break;
        case 'ollama':
        default:
          [response, tokenUsage] = await this.generateWithOllama(prompt, callOptions);
      }
      
      // Update metrics
      this.updateMetrics(provider, callOptions.model, Date.now() - startTime, tokenUsage, false);
      
      // Track successful call in analytics
      analyticsService.trackEvent('llm_call', {
        provider,
        model: callOptions.model,
        latency: Date.now() - startTime,
        inputTokens: tokenUsage?.input || 0,
        outputTokens: tokenUsage?.output || 0,
        success: true
      });
      
      return response;
    } catch (error) {
      // Update error metrics
      this.updateMetrics(provider, callOptions.model, Date.now() - startTime, null, true);
      
      // Track error in analytics
      analyticsService.trackError(error, {
        context: 'LLM generation',
        provider,
        model: callOptions.model,
        latency: Date.now() - startTime,
      });
      
      logger.error(`Error generating LLM response with ${provider}: ${error.message}`);
      
      // Try fallback providers if enabled
      if (this.fallbackEnabled && this.fallbackProviders.length > 0) {
        return await this.tryFallbackProviders(prompt, callOptions, provider);
      } else if (this.provider !== 'ollama' && this.clients.ollama) {
        // Default fallback to Ollama if available
        logger.info('Falling back to Ollama');
        try {
          [response, tokenUsage] = await this.generateWithOllama(prompt, callOptions);
          
          // Update metrics for fallback
          this.updateMetrics('ollama', callOptions.model, Date.now() - startTime, tokenUsage, false);
          
          return response;
        } catch (ollamaError) {
          logger.error(`Ollama fallback also failed: ${ollamaError.message}`);
          throw error; // Throw original error
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Try fallback providers in sequence
   */
  async tryFallbackProviders(prompt, options, failedProvider) {
    for (const provider of this.fallbackProviders) {
      // Skip the already failed provider
      if (provider.toLowerCase() === failedProvider.toLowerCase()) {
        continue;
      }
      
      // Skip if client not initialized
      if (!this.clients[provider.toLowerCase()]) {
        continue;
      }
      
      logger.info(`Trying fallback provider: ${provider}`);
      
      try {
        let response, tokenUsage;
        
        switch (provider.toLowerCase()) {
          case 'openai':
            [response, tokenUsage] = await this.generateWithOpenAI(prompt, options);
            break;
          case 'claude':
            [response, tokenUsage] = await this.generateWithClaude(prompt, options);
            break;
          case 'gemini':
            [response, tokenUsage] = await this.generateWithGemini(prompt, options);
            break;
          case 'ollama':
            [response, tokenUsage] = await this.generateWithOllama(prompt, options);
            break;
        }
        
        // Update metrics for successful fallback
        this.updateMetrics(provider, options.model, 0, tokenUsage, false);
        
        // Track successful fallback
        analyticsService.trackEvent('llm_fallback_success', {
          originalProvider: failedProvider,
          fallbackProvider: provider,
          model: options.model
        });
        
        return response;
      } catch (error) {
        logger.warn(`Fallback to ${provider} failed: ${error.message}`);
        continue;
      }
    }
    
    // If all fallbacks failed, throw error
    throw new Error(`LLM generation failed with all providers`);
  }
  
  /**
   * Generate response with OpenAI
   */
  async generateWithOpenAI(prompt, options) {
    if (!this.clients.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const model = options.model || 'gpt-3.5-turbo';
    
    const response = await this.clients.openai.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    });
    
    const tokenUsage = {
      input: response.data.usage?.prompt_tokens || 0,
      output: response.data.usage?.completion_tokens || 0,
      total: response.data.usage?.total_tokens || 0
    };
    
    return [response.data.choices[0].message.content.trim(), tokenUsage];
  }
  
  /**
   * Generate response with Claude/Anthropic
   */
  async generateWithClaude(prompt, options) {
    if (!this.clients.claude) {
      throw new Error('Claude client not initialized');
    }
    
    const model = options.model || 'claude-2';
    
    const response = await axios.post(
      `${this.clients.claude.baseURL}/v1/messages`,
      {
        model,
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        messages: [{ role: 'user', content: prompt }],
      },
      { headers: this.clients.claude.headers }
    );
    
    // Claude doesn't directly return token usage in standard API
    const tokenUsage = {
      input: Math.ceil(prompt.length / 4), // Rough estimate
      output: Math.ceil(response.data.content[0].text.length / 4), // Rough estimate
      total: 0
    };
    tokenUsage.total = tokenUsage.input + tokenUsage.output;
    
    return [response.data.content[0].text.trim(), tokenUsage];
  }
  
  /**
   * Generate response with Google Gemini
   */
  async generateWithGemini(prompt, options) {
    if (!this.clients.gemini) {
      throw new Error('Gemini client not initialized');
    }
    
    const model = options.model || 'gemini-pro';
    
    const response = await axios.post(
      `${this.clients.gemini.baseURL}/v1beta/models/${model}:generateContent?key=${this.clients.gemini.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
        },
      }
    );
    
    // Gemini doesn't directly return token usage in standard API
    const tokenUsage = {
      input: Math.ceil(prompt.length / 4), // Rough estimate
      output: Math.ceil(response.data.candidates[0].content.parts[0].text.length / 4), // Rough estimate
      total: 0
    };
    tokenUsage.total = tokenUsage.input + tokenUsage.output;
    
    return [response.data.candidates[0].content.parts[0].text.trim(), tokenUsage];
  }
  
  /**
   * Generate response with Ollama
   */
  async generateWithOllama(prompt, options) {
    if (!this.clients.ollama) {
      throw new Error('Ollama client not initialized');
    }
    
    const model = options.model || 'llama2';
    
    try {
      const response = await axios.post(
        `${this.clients.ollama.baseURL}/api/generate`,
        {
          model,
          prompt,
          options: {
            temperature: options.temperature,
            num_predict: options.max_tokens,
          },
        }
      );
      
      // Ollama doesn't directly return token usage in standard API
      const tokenUsage = {
        input: Math.ceil(prompt.length / 4), // Rough estimate
        output: Math.ceil(response.data.response.length / 4), // Rough estimate
        total: 0
      };
      tokenUsage.total = tokenUsage.input + tokenUsage.output;
      
      return [response.data.response.trim(), tokenUsage];
    } catch (error) {
      logger.error(`Ollama error: ${error.message}`);
      if (error.response?.data) {
        logger.error(`Ollama error details: ${JSON.stringify(error.response.data)}`);
      }
      throw error;
    }
  }
  
  /**
   * Update metrics
   */
  updateMetrics(provider, model, latency, tokenUsage, isError) {
    this.metrics.totalCalls++;
    
    if (isError) {
      this.metrics.errors++;
    }
    
    // Update model-specific metrics
    const modelKey = `${provider}_${model}`;
    if (!this.metrics.callsByModel[modelKey]) {
      this.metrics.callsByModel[modelKey] = 0;
      this.metrics.tokensByModel[modelKey] = 0;
    }
    
    this.metrics.callsByModel[modelKey]++;
    
    if (tokenUsage) {
      this.metrics.totalTokens += tokenUsage.total;
      this.metrics.tokensByModel[modelKey] += tokenUsage.total;
    }
    
    // Update average latency
    if (latency > 0) {
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.totalCalls - 1) + latency) / this.metrics.totalCalls;
    }
  }
  
  /**
   * Stream response from LLM for real-time updates
   * @param {string} prompt - The prompt to send to the LLM
   * @param {Object} options - Additional options for the API call
   * @returns {AsyncGenerator<string>} Generated text chunks
   */
  async *streamResponse(prompt, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const callOptions = {
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 1000,
      model: options.model || this.model,
      ...options
    };
    
    const provider = options.provider || this.provider;
    const startTime = Date.now();
    let tokenCount = 0;
    
    try {
      let generator;
      
      // Select provider for streaming
      switch (provider.toLowerCase()) {
        case 'openai':
          generator = this.streamWithOpenAI(prompt, callOptions);
          break;
        case 'claude':
          generator = this.streamWithClaude(prompt, callOptions);
          break;
        case 'gemini':
          generator = this.streamWithGemini(prompt, callOptions);
          break;
        case 'ollama':
        default:
          generator = this.streamWithOllama(prompt, callOptions);
          break;
      }
      
      // Stream response chunks
      for await (const chunk of generator) {
        tokenCount += Math.ceil(chunk.length / 4); // Rough estimate
        yield chunk;
      }
      
      // Update metrics after streaming completes
      const tokenUsage = {
        input: Math.ceil(prompt.length / 4),
        output: tokenCount,
        total: Math.ceil(prompt.length / 4) + tokenCount
      };
      
      this.updateMetrics(provider, callOptions.model, Date.now() - startTime, tokenUsage, false);
      
      // Track streaming in analytics
      analyticsService.trackEvent('llm_stream', {
        provider,
        model: callOptions.model,
        latency: Date.now() - startTime,
        inputTokens: tokenUsage.input,
        outputTokens: tokenUsage.output,
        success: true
      });
    } catch (error) {
      // Update error metrics
      this.updateMetrics(provider, callOptions.model, Date.now() - startTime, null, true);
      
      // Track error in analytics
      analyticsService.trackError(error, {
        context: 'LLM streaming',
        provider,
        model: callOptions.model,
        latency: Date.now() - startTime,
      });
      
      logger.error(`Error streaming LLM response: ${error.message}`);
      
      // Try fallback for streaming
      if (this.provider !== 'ollama' && this.clients.ollama) {
        logger.info('Falling back to Ollama for streaming');
        try {
          for await (const chunk of this.streamWithOllama(prompt, callOptions)) {
            tokenCount += Math.ceil(chunk.length / 4); // Rough estimate
            yield chunk;
          }
          
          // Update metrics for fallback
          const tokenUsage = {
            input: Math.ceil(prompt.length / 4),
            output: tokenCount,
            total: Math.ceil(prompt.length / 4) + tokenCount
          };
          this.updateMetrics('ollama', callOptions.model, Date.now() - startTime, tokenUsage, false);
        } catch (ollamaError) {
          logger.error(`Ollama streaming fallback also failed: ${ollamaError.message}`);
          throw error; // Throw original error
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Stream response with OpenAI
   */
  async *streamWithOpenAI(prompt, options) {
    if (!this.clients.openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    const model = options.model || 'gpt-3.5-turbo';
    
    const response = await this.clients.openai.createChatCompletion({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true,
    }, { responseType: 'stream' });
    
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.includes('[DONE]')) continue;
        
        try {
          const parsedLine = JSON.parse(line.replace(/^data: /, ''));
          const content = parsedLine.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (error) {
          // Skip lines that can't be parsed
        }
      }
    }
  }
  
  /**
   * Stream response with Claude/Anthropic
   */
  async *streamWithClaude(prompt, options) {
    if (!this.clients.claude) {
      throw new Error('Claude client not initialized');
    }
    
    const model = options.model || 'claude-2';
    
    const response = await axios.post(
      `${this.clients.claude.baseURL}/v1/messages`,
      {
        model,
        max_tokens: options.max_tokens,
        temperature: options.temperature,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      },
      { 
        headers: this.clients.claude.headers,
        responseType: 'stream'
      }
    );
    
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        if (line.includes('[DONE]')) continue;
        
        try {
          const parsedLine = JSON.parse(line.replace(/^data: /, ''));
          const content = parsedLine.delta?.text;
          if (content) {
            yield content;
          }
        } catch (error) {
          // Skip lines that can't be parsed
        }
      }
    }
  }
  
  /**
   * Stream response with Google Gemini
   */
  async *streamWithGemini(prompt, options) {
    if (!this.clients.gemini) {
      throw new Error('Gemini client not initialized');
    }
    
    const model = options.model || 'gemini-pro';
    
    const response = await axios.post(
      `${this.clients.gemini.baseURL}/v1beta/models/${model}:streamGenerateContent?key=${this.clients.gemini.apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.max_tokens,
        },
      },
      { responseType: 'stream' }
    );
    
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        try {
          const parsedLine = JSON.parse(line);
          const content = parsedLine.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            yield content;
          }
        } catch (error) {
          // Skip lines that can't be parsed
        }
      }
    }
  }
  
  /**
   * Stream response with Ollama
   */
  async *streamWithOllama(prompt, options) {
    if (!this.clients.ollama) {
      throw new Error('Ollama client not initialized');
    }
    
    const model = options.model || 'llama2';
    
    const response = await axios.post(
      `${this.clients.ollama.baseURL}/api/generate`,
      {
        model,
        prompt,
        options: {
          temperature: options.temperature,
          num_predict: options.max_tokens,
        },
        stream: true,
      },
      { responseType: 'stream' }
    );
    
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      for (const line of lines) {
        try {
          const parsedLine = JSON.parse(line);
          if (parsedLine.response) {
            yield parsedLine.response;
          }
        } catch (error) {
          // Skip lines that can't be parsed
        }
      }
    }
  }
  
  /**
   * Get list of available models
   */
  async getAvailableModels() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    const models = {};
    
    try {
      // Get OpenAI models
      if (this.clients.openai) {
        try {
          const openaiModels = await this.clients.openai.listModels();
          models.openai = openaiModels.data.data
            .filter(model => model.id.includes('gpt'))
            .map(model => model.id);
        } catch (error) {
          logger.error(`Error getting OpenAI models: ${error.message}`);
        }
      }
      
      // Get Claude models
      if (this.clients.claude) {
        try {
          const claudeModels = await axios.get(
            `${this.clients.claude.baseURL}/v1/models`,
            { headers: this.clients.claude.headers }
          );
          models.claude = claudeModels.data.data.map(model => model.id);
        } catch (error) {
          logger.error(`Error getting Claude models: ${error.message}`);
        }
      }
      
      // Get Gemini models
      if (this.clients.gemini) {
        try {
          const geminiModels = await axios.get(
            `${this.clients.gemini.baseURL}/v1beta/models?key=${this.clients.gemini.apiKey}`
          );
          models.gemini = geminiModels.data.models.map(model => model.name);
        } catch (error) {
          logger.error(`Error getting Gemini models: ${error.message}`);
        }
      }
      
      // Get Ollama models
      if (this.clients.ollama) {
        try {
          const ollamaModels = await axios.get(`${this.clients.ollama.baseURL}/api/tags`);
          models.ollama = ollamaModels.data.models.map(model => model.name);
        } catch (error) {
          logger.error(`Error getting Ollama models: ${error.message}`);
        }
      }
      
      return models;
    } catch (error) {
      logger.error(`Error getting available models: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalCalls > 0 
        ? ((this.metrics.totalCalls - this.metrics.errors) / this.metrics.totalCalls) * 100 
        : 100,
      initializedProviders: Object.keys(this.clients),
      defaultProvider: this.provider,
      defaultModel: this.model,
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      totalTokens: 0,
      averageLatency: 0,
      errors: 0,
      callsByModel: {},
      tokensByModel: {},
    };
    
    logger.info('LLM metrics reset');
  }
}

module.exports = new LLMProvider(); 