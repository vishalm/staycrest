/**
 * Llama Service
 * 
 * Manages interactions with the Llama LLM model via APIs
 */

import ApiService from './api-service.js';
import LLMConfig from '../config/llm-config.js';
import Analytics from './analytics-service.js';

class LlamaService {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.supportedModels = [];
    this.currentModel = null;
    this.defaultModel = 'llama2';
    this.metrics = {
      totalCalls: 0,
      totalTokens: 0,
      averageLatency: 0,
      errors: 0
    };
  }
  
  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Load configuration
      this.config = LLMConfig;
      
      // Set default model
      this.currentModel = this.config.defaultModel || this.defaultModel;
      
      // Get supported models
      await this.getSupportedModels();
      
      this.isInitialized = true;
      console.log('Llama service initialized');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Llama service:', error);
      return false;
    }
  }
  
  /**
   * Get list of supported models
   */
  async getSupportedModels() {
    try {
      const response = await ApiService.get('/api/llm/models');
      
      if (response.success) {
        this.supportedModels = response.data.models;
        return this.supportedModels;
      }
      
      // Fallback to default models
      this.supportedModels = ['llama2', 'llama2-uncensored', 'mistral'];
      return this.supportedModels;
    } catch (error) {
      console.error('Error getting supported models:', error);
      this.supportedModels = ['llama2', 'llama2-uncensored', 'mistral'];
      return this.supportedModels;
    }
  }
  
  /**
   * Set the active model
   */
  setModel(modelName) {
    if (this.supportedModels.includes(modelName)) {
      this.currentModel = modelName;
      return true;
    }
    return false;
  }
  
  /**
   * Generate text completion
   */
  async generateText(prompt, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    
    try {
      const requestOptions = {
        model: options.model || this.currentModel,
        prompt,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.maxTokens || 500,
        top_p: options.topP || 0.9,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stop: options.stop || null
      };
      
      const response = await ApiService.post('/api/llm/generate', requestOptions);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, response.data?.usage?.total_tokens || 0, false);
      
      // Track in analytics
      Analytics.trackEvent('llm_generate', {
        model: requestOptions.model,
        promptLength: prompt.length,
        outputLength: response.data.text.length,
        latency
      });
      
      return {
        text: response.data.text,
        usage: response.data.usage,
        model: response.data.model,
        latency
      };
    } catch (error) {
      console.error('Error generating text:', error);
      
      // Update error metrics
      this.updateMetrics(Date.now() - startTime, 0, true);
      
      // Track error
      Analytics.trackEvent('llm_error', {
        model: options.model || this.currentModel,
        promptLength: prompt.length,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Generate chat completion
   */
  async generateChatResponse(messages, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    
    try {
      const requestOptions = {
        model: options.model || this.currentModel,
        messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.maxTokens || 500,
        top_p: options.topP || 0.9,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: options.stream || false
      };
      
      const response = await ApiService.post('/api/llm/chat', requestOptions);
      
      // Update metrics
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, response.data?.usage?.total_tokens || 0, false);
      
      // Track in analytics
      Analytics.trackEvent('llm_chat', {
        model: requestOptions.model,
        messages: messages.length,
        outputLength: response.data.message.content.length,
        latency
      });
      
      return {
        message: response.data.message,
        usage: response.data.usage,
        model: response.data.model,
        latency
      };
    } catch (error) {
      console.error('Error generating chat response:', error);
      
      // Update error metrics
      this.updateMetrics(Date.now() - startTime, 0, true);
      
      // Track error
      Analytics.trackEvent('llm_error', {
        model: options.model || this.currentModel,
        messages: messages.length,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Stream chat completion for real-time responses
   */
  async streamChatResponse(messages, options = {}, onChunk, onComplete, onError) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const startTime = Date.now();
    let completedText = '';
    
    try {
      const requestOptions = {
        model: options.model || this.currentModel,
        messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.maxTokens || 500,
        top_p: options.topP || 0.9,
        frequency_penalty: options.frequencyPenalty || 0,
        presence_penalty: options.presencePenalty || 0,
        stream: true
      };
      
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ApiService.getToken()}`
        },
        body: JSON.stringify(requestOptions)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        // Process each line
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            
            if (dataStr === '[DONE]') {
              break;
            }
            
            try {
              const data = JSON.parse(dataStr);
              
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                completedText += content;
                
                if (onChunk) {
                  onChunk(content);
                }
              }
            } catch (parseError) {
              console.error('Error parsing stream chunk:', parseError);
            }
          }
        }
      }
      
      // Complete the stream
      const latency = Date.now() - startTime;
      
      // Estimate tokens
      const totalTokens = Math.ceil((completedText.length + JSON.stringify(messages).length) / 4);
      
      // Update metrics
      this.updateMetrics(latency, totalTokens, false);
      
      // Track in analytics
      Analytics.trackEvent('llm_chat_stream', {
        model: requestOptions.model,
        messages: messages.length,
        outputLength: completedText.length,
        latency
      });
      
      if (onComplete) {
        onComplete({
          content: completedText,
          model: requestOptions.model,
          latency
        });
      }
      
      return {
        content: completedText,
        model: requestOptions.model,
        latency
      };
    } catch (error) {
      console.error('Error streaming chat response:', error);
      
      // Update error metrics
      this.updateMetrics(Date.now() - startTime, 0, true);
      
      // Track error
      Analytics.trackEvent('llm_error', {
        model: options.model || this.currentModel,
        messages: messages.length,
        error: error.message
      });
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * Update service metrics
   */
  updateMetrics(latency, tokens, isError) {
    this.metrics.totalCalls++;
    
    if (tokens) {
      this.metrics.totalTokens += tokens;
    }
    
    if (isError) {
      this.metrics.errors++;
    }
    
    // Update average latency
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalCalls - 1) + latency) / this.metrics.totalCalls;
  }
  
  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalCalls > 0 
        ? ((this.metrics.totalCalls - this.metrics.errors) / this.metrics.totalCalls) * 100 
        : 100,
      currentModel: this.currentModel,
      supportedModels: this.supportedModels
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
      errors: 0
    };
  }
}

// Create singleton instance
const llamaService = new LlamaService();

export default llamaService; 