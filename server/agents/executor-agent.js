/**
 * Executor Agent for executing plans from the planner
 */
class ExecutorAgent {
  constructor(llmProvider, toolManager) {
    this.llmProvider = llmProvider;
    this.toolManager = toolManager;
    this.isInitialized = false;
    this.executionHistory = [];
    this.maxHistorySize = 100;
  }
  
  /**
   * Initialize the executor agent
   */
  async initialize() {
    try {
      this.isInitialized = true;
      console.log('Executor agent initialized');
    } catch (error) {
      console.error('Failed to initialize executor agent:', error);
      throw error;
    }
  }
  
  /**
   * Execute a complete plan
   * @param {Object} plan - Plan from the planner agent
   * @returns {Object} Execution results
   */
  async execute(plan) {
    const results = {
      plan_id: this.generateExecutionId(),
      steps: [],
      success: true,
      errors: [],
      start_time: new Date(),
      end_time: null
    };
    
    try {
      // Execute each step in sequence
      for (const step of plan.steps) {
        const stepResult = await this.executeStep(step);
        results.steps.push(stepResult);
        
        // If step failed and it's critical, abort execution
        if (!stepResult.success && !this.canContinueAfterFailure(step)) {
          results.success = false;
          results.errors.push({
            step: step.id,
            message: `Critical step failed: ${stepResult.error}`
          });
          break;
        }
      }
    } catch (error) {
      results.success = false;
      results.errors.push({
        step: 'overall_execution',
        message: error.message
      });
    }
    
    results.end_time = new Date();
    
    // Store execution in history (limited size)
    this.updateExecutionHistory(results);
    
    return results;
  }
  
  /**
   * Execute a single step
   * @param {Object} step - Step from the plan
   * @returns {Object} Step execution result
   */
  async executeStep(step) {
    const result = {
      step_id: step.id,
      description: step.description,
      tool: step.tool,
      success: false,
      start_time: new Date(),
      end_time: null,
      result: null,
      error: null
    };
    
    try {
      // Check if tool exists
      if (!this.toolManager.hasTool(step.tool)) {
        throw new Error(`Tool not found: ${step.tool}`);
      }
      
      // Execute the tool
      const toolResult = await this.toolManager.executeTool(
        step.tool,
        step.parameters
      );
      
      result.success = true;
      result.result = toolResult;
    } catch (error) {
      result.success = false;
      result.error = error.message;
      
      // Attempt error handling if specified
      if (step.error_handling) {
        try {
          result.error_handling = await this.handleStepError(step, error);
        } catch (handlingError) {
          result.error_handling_failed = true;
        }
      }
    }
    
    result.end_time = new Date();
    return result;
  }
  
  /**
   * Handle step execution error
   * @param {Object} step - Failed step
   * @param {Error} error - Error that occurred
   * @returns {Object} Error handling result
   */
  async handleStepError(step, error) {
    // Use LLM to generate error handling strategy
    const errorPrompt = `
You need to handle an error in a step of a hotel search plan.

## STEP:
${JSON.stringify(step, null, 2)}

## ERROR:
${error.message}

## ERROR HANDLING STRATEGY:
${step.error_handling || "No specific error handling strategy provided."}

What's the best way to handle this error? Consider:
1. Is there an alternative tool that could achieve similar results?
2. Can we modify the parameters and retry?
3. Should we skip this step and continue with the rest?
4. Is this error fatal to the entire plan?

Provide a JSON response in this format:
{
  "action": "retry|alternative|skip|abort",
  "details": {
    // For retry: modified parameters
    // For alternative: alternative tool and parameters
    // For skip or abort: reason
  }
}
`;
    
    const errorHandlingResponse = await this.llmProvider.generateResponse(errorPrompt, {
      temperature: 0.2,
      max_tokens: 500
    });
    
    // Parse the response
    try {
      const jsonMatch = errorHandlingResponse.match(/```json\n([\s\S]*?)\n```/) || 
                        errorHandlingResponse.match(/{[\s\S]*}/);
      
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : errorHandlingResponse;
      const strategy = JSON.parse(jsonString);
      
      // Implement the error handling strategy
      switch (strategy.action) {
        case 'retry':
          return await this.retryStep(step, strategy.details);
        case 'alternative':
          return await this.useAlternativeTool(step, strategy.details);
        case 'skip':
          return { skipped: true, reason: strategy.details.reason };
        case 'abort':
          return { aborted: true, reason: strategy.details.reason };
        default:
          return { unknown_action: true };
      }
    } catch (parseError) {
      return { parsing_failed: true, raw_response: errorHandlingResponse };
    }
  }
  
  /**
   * Retry a step with modified parameters
   */
  async retryStep(step, modifiedParams) {
    const retryStep = {
      ...step,
      parameters: {
        ...step.parameters,
        ...modifiedParams
      },
      id: `${step.id}_retry`
    };
    
    return await this.executeStep(retryStep);
  }
  
  /**
   * Use an alternative tool to complete a step
   */
  async useAlternativeTool(step, alternative) {
    const alternativeStep = {
      ...step,
      tool: alternative.tool,
      parameters: alternative.parameters,
      id: `${step.id}_alt`
    };
    
    return await this.executeStep(alternativeStep);
  }
  
  /**
   * Check if execution can continue after a step failure
   */
  canContinueAfterFailure(step) {
    // Check if step is marked as optional
    return step.optional === true;
  }
  
  /**
   * Generate unique execution ID
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
  
  /**
   * Update execution history with limited size
   */
  updateExecutionHistory(execution) {
    this.executionHistory.unshift(execution);
    
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.pop();
    }
  }
  
  /**
   * Get recent execution history
   * @param {number} limit - Number of executions to return
   * @returns {Array} Recent executions
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(0, limit);
  }
  
  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      executionCount: this.executionHistory.length,
      toolsAvailable: this.toolManager.getRegisteredTools().length
    };
  }
}

module.exports = ExecutorAgent; 