/**
 * Planner Agent for decomposing user queries into actionable steps
 */
class PlannerAgent {
  constructor(llmProvider, memorySystem) {
    this.llmProvider = llmProvider;
    this.memorySystem = memorySystem;
    this.isInitialized = false;
  }
  
  /**
   * Initialize the planner agent
   */
  async initialize() {
    try {
      this.isInitialized = true;
      console.log('Planner agent initialized');
    } catch (error) {
      console.error('Failed to initialize planner agent:', error);
      throw error;
    }
  }
  
  /**
   * Create a plan from a user query
   * @param {string} query - User's query
   * @param {Object} context - Additional context (user preferences, history)
   * @returns {Object} A structured plan
   */
  async createPlan(query, context = {}) {
    try {
      // Get relevant memories
      const memories = await this.memorySystem.retrieve(query);
      
      // Create planning prompt
      const planningPrompt = this.createPlanningPrompt(query, context, memories);
      
      // Generate plan using LLM
      const planRaw = await this.llmProvider.generateResponse(planningPrompt, {
        temperature: 0.2,
        max_tokens: 1500
      });
      
      // Parse the plan
      const plan = this.parsePlan(planRaw);
      
      return {
        query,
        context,
        steps: plan.steps,
        resources: plan.resources,
        expectations: plan.expectations,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error creating plan:', error);
      throw error;
    }
  }
  
  /**
   * Create planning prompt
   */
  createPlanningPrompt(query, context, memories) {
    const userPreferences = context.preferences || {};
    const userHistory = context.history || [];
    
    return `
TASK: Create a detailed execution plan for the following user query about hotel loyalty programs.

## USER QUERY:
${query}

## USER PREFERENCES:
${JSON.stringify(userPreferences, null, 2)}

## USER HISTORY:
${userHistory.map(h => `- ${h}`).join('\n')}

## RELEVANT MEMORIES:
${memories.map(m => `- ${m.text} (${m.timestamp})`).join('\n')}

## INSTRUCTIONS:
1. Break down the query into a series of executable steps
2. For each step, specify:
   - Tool to use
   - Required parameters
   - Expected output
3. Identify relevant hotel loyalty programs to search
4. Consider user preferences and history
5. Include error handling steps

## OUTPUT FORMAT:
Provide your plan in the following JSON format:
{
  "steps": [
    {
      "id": "step_1",
      "description": "Step description",
      "tool": "tool_name",
      "parameters": {"param1": "value1"},
      "expected_output": "Description of expected output",
      "error_handling": "What to do if this step fails"
    }
  ],
  "resources": ["list", "of", "required", "resources"],
  "expectations": "Expected outcome of the plan"
}
`;
  }
  
  /**
   * Parse the plan from LLM output
   */
  parsePlan(planRaw) {
    try {
      // Find JSON in the response
      const jsonMatch = planRaw.match(/```json\n([\s\S]*?)\n```/) || 
                        planRaw.match(/{[\s\S]*}/);
                        
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : planRaw;
      
      // Parse the JSON
      const plan = JSON.parse(jsonString);
      
      // Validate the plan has required components
      if (!plan.steps || !Array.isArray(plan.steps)) {
        plan.steps = [];
      }
      
      if (!plan.resources || !Array.isArray(plan.resources)) {
        plan.resources = [];
      }
      
      if (!plan.expectations) {
        plan.expectations = "Complete the user query successfully.";
      }
      
      return plan;
    } catch (error) {
      console.error('Error parsing plan:', error);
      // Return fallback plan
      return {
        steps: [
          {
            id: "fallback_step",
            description: "Directly search for hotels based on user query",
            tool: "search_hotels",
            parameters: { query: query },
            expected_output: "List of relevant hotels",
            error_handling: "Return apologetic message to user"
          }
        ],
        resources: [],
        expectations: "Answer user query with available information"
      };
    }
  }
  
  /**
   * Optimize loyalty strategy
   * @param {Object} preferences - User's loyalty preferences
   * @returns {Object} Optimized loyalty strategy
   */
  async optimizeLoyalty(preferences) {
    const optimizationPrompt = `
Create an optimized loyalty program strategy for a user with these preferences:
${JSON.stringify(preferences, null, 2)}

Analyze the following aspects:
1. Best loyalty programs for this user's travel patterns
2. Optimal point earning strategies
3. Most valuable redemption options
4. Status match opportunities
5. Credit card synergies

Provide a clear, actionable plan for maximizing value.
`;
    
    const response = await this.llmProvider.generateResponse(optimizationPrompt, {
      temperature: 0.3,
      max_tokens: 1000
    });
    
    return {
      preferences,
      strategy: response,
      timestamp: new Date()
    };
  }
  
  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.isInitialized
    };
  }
}

module.exports = PlannerAgent; 