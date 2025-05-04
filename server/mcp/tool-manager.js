// server/mcp/tool-manager.js

const logger = require('../services/logging-service').getLogger('tool-manager');

/**
 * MCP Tool Manager for registering and executing tools
 */
class ToolManager {
  constructor() {
    this.tools = new Map();
    this.schemas = new Map();
    this.metrics = {
      executions: 0,
      errors: 0,
      toolUsage: {},
      averageExecutionTime: {},
      totalExecutionTime: {},
      lastExecution: {},
      lastError: {}
    };
    this.logger = logger;
    this.logger.info('Tool Manager initialized');
  }
  
  /**
   * Register a new tool
   * @param {string} name - Tool name
   * @param {Function} implementation - Tool implementation function
   * @param {Object} schema - JSON schema for tool parameters
   * @returns {boolean} Registration success
   */
  registerTool(name, implementation, schema = null) {
    try {
      if (this.tools.has(name)) {
        this.logger.warn(`Tool ${name} is already registered. Overwriting.`, {
          tool: name,
          action: 'overwrite'
        });
      }
      
      // Validate that implementation is a function
      if (typeof implementation !== 'function') {
        throw new Error('Tool implementation must be a function');
      }
      
      // Register the tool
      this.tools.set(name, implementation);
      
      // Register schema if provided
      if (schema) {
        this.schemas.set(name, schema);
      }
      
      // Initialize metrics for this tool
      this.metrics.toolUsage[name] = 0;
      this.metrics.averageExecutionTime[name] = 0;
      this.metrics.totalExecutionTime[name] = 0;
      
      this.logger.info(`Tool registered: ${name}`, { 
        tool: name, 
        action: 'register',
        hasSchema: !!schema
      });
      
      return true;
    } catch (error) {
      this.logger.logError(error, `Error registering tool ${name}`);
      return false;
    }
  }
  
  /**
   * Check if a tool exists
   * @param {string} name - Tool name
   * @returns {boolean} Whether tool exists
   */
  hasTool(name) {
    return this.tools.has(name);
  }
  
  /**
   * Execute a tool
   * @param {string} name - Tool name
   * @param {Object} parameters - Tool parameters
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(name, parameters = {}) {
    const startTime = process.hrtime();
    const traceId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    try {
      this.logger.debug(`Executing tool: ${name}`, { 
        tool: name, 
        traceId,
        parametersKeys: Object.keys(parameters)
      });
      
      // Check if tool exists
      if (!this.tools.has(name)) {
        const error = new Error(`Tool not found: ${name}`);
        this.logger.logError(error, `Tool not found: ${name}`, { traceId });
        throw error;
      }
      
      // Get tool implementation
      const tool = this.tools.get(name);
      
      // Validate parameters against schema if available
      if (this.schemas.has(name)) {
        try {
          this.validateParameters(name, parameters);
        } catch (error) {
          this.logger.logError(error, `Parameter validation failed for tool: ${name}`, { 
            traceId, 
            parameters: Object.keys(parameters)
          });
          throw error;
        }
      }
      
      // Execute the tool
      this.logger.debug(`Running tool implementation: ${name}`, { traceId });
      const result = await tool(parameters);
      
      // Update metrics
      this.updateMetrics(name, startTime, true, traceId);
      
      this.logger.debug(`Tool executed successfully: ${name}`, { 
        traceId,
        resultType: result ? typeof result : 'null',
        resultIsArray: Array.isArray(result)
      });
      
      return result;
    } catch (error) {
      // Update error metrics
      this.updateMetrics(name, startTime, false, traceId, error);
      
      this.metrics.lastError[name] = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
        parameters: Object.keys(parameters)
      };
      
      this.logger.logError(error, `Error executing tool ${name}`, { traceId });
      throw error;
    }
  }
  
  /**
   * Validate parameters against schema
   * @param {string} name - Tool name
   * @param {Object} parameters - Parameters to validate
   * @throws {Error} If validation fails
   */
  validateParameters(name, parameters) {
    const schema = this.schemas.get(name);
    
    // Basic schema validation (in production, use a proper JSON Schema validator)
    
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (parameters[requiredField] === undefined) {
          throw new Error(`Missing required parameter: ${requiredField}`);
        }
      }
    }
    
    // Check property types
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (parameters[propName] !== undefined) {
          // Type checking
          const paramType = typeof parameters[propName];
          let expectedType = propSchema.type;
          
          // Convert JSON Schema types to JavaScript types
          if (expectedType === 'integer' || expectedType === 'number') {
            expectedType = 'number';
          }
          
          if (expectedType === 'array' && !Array.isArray(parameters[propName])) {
            throw new Error(`Parameter ${propName} should be an array`);
          } else if (expectedType !== 'array' && paramType !== expectedType) {
            throw new Error(`Parameter ${propName} should be of type ${expectedType}, got ${paramType}`);
          }
        }
      }
    }
  }
  
  /**
   * Update metrics after tool execution
   * @param {string} name - Tool name
   * @param {Array} startTime - Start time from process.hrtime()
   * @param {boolean} success - Whether execution was successful
   * @param {string} traceId - Trace ID for correlation
   * @param {Error} error - Error if execution failed
   */
  updateMetrics(name, startTime, success, traceId, error = null) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const executionTimeMs = (seconds * 1000) + (nanoseconds / 1000000);
    
    // Update general metrics
    this.metrics.executions++;
    if (!success) {
      this.metrics.errors++;
    }
    
    // Update tool-specific metrics
    this.metrics.toolUsage[name] = (this.metrics.toolUsage[name] || 0) + 1;
    
    // Update execution time metrics
    if (!this.metrics.totalExecutionTime[name]) {
      this.metrics.totalExecutionTime[name] = 0;
    }
    
    this.metrics.totalExecutionTime[name] += executionTimeMs;
    this.metrics.averageExecutionTime[name] = 
      this.metrics.totalExecutionTime[name] / this.metrics.toolUsage[name];
    
    // Save last execution info
    this.metrics.lastExecution[name] = {
      timestamp: new Date(),
      executionTimeMs,
      success,
      traceId
    };
    
    // Log execution metrics
    this.logger.logEvent(
      success ? 'debug' : 'warn',
      `Tool execution ${success ? 'completed' : 'failed'}: ${name}`,
      {
        tool: name,
        success,
        traceId,
        errorMessage: error ? error.message : null
      },
      {
        executionTimeMs,
        totalExecutions: this.metrics.toolUsage[name],
        averageExecutionTime: this.metrics.averageExecutionTime[name]
      }
    );
    
    // Try to update Prometheus metrics if health module is loaded
    try {
      const { metrics } = require('../routes/health');
      if (metrics && metrics.toolUsage) {
        metrics.toolUsage.inc({ 
          tool: name, 
          status: success ? 'success' : 'error' 
        });
      }
    } catch (e) {
      // Health module not loaded yet, ignore
    }
  }
  
  /**
   * Get a list of registered tools
   * @returns {Array<string>} List of tool names
   */
  getRegisteredTools() {
    return Array.from(this.tools.keys());
  }
  
  /**
   * Get tool schema
   * @param {string} name - Tool name
   * @returns {Object|null} Tool schema
   */
  getToolSchema(name) {
    return this.schemas.get(name) || null;
  }
  
  /**
   * Get tool execution metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.executions > 0 
        ? ((this.metrics.executions - this.metrics.errors) / this.metrics.executions) * 100 
        : 100,
      registeredTools: this.getRegisteredTools(),
      toolCount: this.tools.size,
      timestamp: new Date()
    };
  }
  
  /**
   * Get execution history for a specific tool
   * @param {string} name - Tool name 
   * @returns {Object} Tool execution history and metrics
   */
  getToolMetrics(name) {
    if (!this.tools.has(name)) {
      return null;
    }
    
    return {
      name,
      usage: this.metrics.toolUsage[name] || 0,
      averageExecutionTime: this.metrics.averageExecutionTime[name] || 0,
      totalExecutionTime: this.metrics.totalExecutionTime[name] || 0,
      lastExecution: this.metrics.lastExecution[name] || null,
      lastError: this.metrics.lastError[name] || null,
      hasSchema: this.schemas.has(name)
    };
  }
  
  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = {
      executions: 0,
      errors: 0,
      toolUsage: {},
      averageExecutionTime: {},
      totalExecutionTime: {},
      lastExecution: {},
      lastError: {}
    };
    
    // Re-initialize tool-specific metrics
    for (const name of this.tools.keys()) {
      this.metrics.toolUsage[name] = 0;
      this.metrics.averageExecutionTime[name] = 0;
      this.metrics.totalExecutionTime[name] = 0;
    }
    
    this.logger.info('Tool metrics cleared');
  }
  
  /**
   * Compose multiple tools into a new tool
   * @param {string} name - New tool name
   * @param {Array<Object>} toolSequence - Sequence of tool calls
   * @param {Object} schema - Schema for the composed tool
   * @returns {boolean} Registration success
   */
  composeTool(name, toolSequence, schema = null) {
    try {
      if (!Array.isArray(toolSequence) || toolSequence.length === 0) {
        throw new Error('Tool sequence must be a non-empty array');
      }
      
      // Create composed tool implementation
      const composedTool = async (parameters) => {
        let result = null;
        
        // Execute each tool in sequence
        for (const step of toolSequence) {
          // Validate step structure
          if (!step.tool || !this.tools.has(step.tool)) {
            throw new Error(`Invalid tool in sequence: ${step.tool}`);
          }
          
          // Prepare parameters for this step
          let stepParams = {};
          
          if (typeof step.parameterMap === 'function') {
            // Use mapping function to transform parameters
            stepParams = step.parameterMap(parameters, result);
          } else if (step.parameterMap) {
            // Use static parameter mapping
            for (const [targetParam, sourcePath] of Object.entries(step.parameterMap)) {
              if (sourcePath.startsWith('params.')) {
                // Get from input parameters
                const sourceKey = sourcePath.replace('params.', '');
                stepParams[targetParam] = parameters[sourceKey];
              } else if (sourcePath.startsWith('result.') && result) {
                // Get from previous result
                const sourceKey = sourcePath.replace('result.', '');
                stepParams[targetParam] = result[sourceKey];
              }
            }
          } else {
            // Use input parameters directly
            stepParams = { ...parameters };
          }
          
          // Execute this tool step
          result = await this.executeTool(step.tool, stepParams);
          
          // Apply result transformations if specified
          if (step.resultTransform && typeof step.resultTransform === 'function') {
            result = step.resultTransform(result);
          }
        }
        
        return result;
      };
      
      // Register the composed tool
      return this.registerTool(name, composedTool, schema);
    } catch (error) {
      this.logger.error(`Error composing tool ${name}: ${error.message}`);
      return false;
    }
  }
}

// Export the ToolManager class
module.exports = { ToolManager };