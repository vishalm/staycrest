// server/agents/agent-system.js

const LLMProvider = require('../services/llm-provider');
const WebAgent = require('./web-agent');
const SearchAgent = require('./search-agent');
const PlannerAgent = require('./planner-agent');
const ExecutorAgent = require('./executor-agent');
const MemorySystem = require('./memory-system');

/**
 * Agent System with MCP architecture
 */
class AgentSystem {
  constructor(toolManager, searchService, loyaltyManager) {
    this.toolManager = toolManager;
    this.searchService = searchService;
    this.loyaltyManager = loyaltyManager;
    
    this.llmProvider = new LLMProvider();
    this.memorySystem = new MemorySystem();
    
    // Initialize agents
    this.agents = {
      planner: new PlannerAgent(this.llmProvider, this.memorySystem),
      executor: new ExecutorAgent(this.llmProvider, this.toolManager),
      search: new SearchAgent(this.llmProvider, this.searchService),
      web: new WebAgent(this.llmProvider, this.loyaltyManager)
    };
    
    this.isInitialized = false;
  }
  
  /**
   * Initialize the agent system
   */
  async initialize() {
    try {
      // Initialize LLM provider
      await this.llmProvider.initialize();
      
      // Initialize agents
      for (const [name, agent] of Object.entries(this.agents)) {
        await agent.initialize();
      }
      
      // Register tools with toolManager
      this.registerTools();
      
      this.isInitialized = true;
      console.log('Agent system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize agent system:', error);
      throw error;
    }
  }
  
  /**
   * Register MCP tools
   */
  registerTools() {
    // Web interaction tools
    this.toolManager.registerTool('navigate_website', async (url) => {
      return this.agents.web.navigate(url);
    });
    
    this.toolManager.registerTool('extract_hotel_data', async (source) => {
      return this.agents.web.extractHotelData(source);
    });
    
    this.toolManager.registerTool('compare_loyalty_programs', async (programs) => {
      return this.agents.web.comparePrograms(programs);
    });
    
    // Search tools
    this.toolManager.registerTool('search_hotels', async (query, filters) => {
      return this.agents.search.searchHotels(query, filters);
    });
    
    this.toolManager.registerTool('get_hotel_reviews', async (hotelId) => {
      return this.agents.search.getReviews(hotelId);
    });
    
    // Planning tools
    this.toolManager.registerTool('create_travel_plan', async (requirements) => {
      return this.agents.planner.createPlan(requirements);
    });
    
    this.toolManager.registerTool('optimize_loyalty_strategy', async (preferences) => {
      return this.agents.planner.optimizeLoyalty(preferences);
    });
  }
  
  /**
   * Process user query using agents
   */
  async processQuery(query, context = {}) {
    try {
      // Step 1: Plan the task
      const plan = await this.agents.planner.createPlan(query, context);
      
      // Step 2: Execute the plan
      const results = await this.agents.executor.execute(plan);
      
      // Step 3: Synthesize response
      const response = await this.synthesizeResponse(query, results);
      
      // Step 4: Store in memory
      await this.memorySystem.store({
        query,
        plan,
        results,
        response,
        timestamp: new Date()
      });
      
      return response;
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }
  
  /**
   * Synthesize final response
   */
  async synthesizeResponse(query, results) {
    const prompt = `
Given the user query: "${query}"
And the following results from various agents:
${JSON.stringify(results, null, 2)}

Create a comprehensive, helpful response that:
1. Directly answers the user's question
2. Provides relevant hotel recommendations
3. Highlights best loyalty program options
4. Includes practical travel advice
5. Mentions any special deals or offers found

Format the response in a clear, conversational manner.
`;
    
    const synthesis = await this.llmProvider.generateResponse(prompt);
    return synthesis;
  }
  
  /**
   * Stream response for real-time updates
   */
  async *streamQuery(query, context = {}) {
    // Yield initial plan
    const plan = await this.agents.planner.createPlan(query, context);
    yield { type: 'plan', data: plan };
    
    // Execute plan steps and yield intermediate results
    for (const step of plan.steps) {
      const stepResult = await this.agents.executor.executeStep(step);
      yield { type: 'step_result', data: stepResult };
    }
    
    // Yield final synthesis
    const response = await this.synthesizeResponse(query, plan.results);
    yield { type: 'final_response', data: response };
  }
  
  /**
   * Get system status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      agents: Object.keys(this.agents).reduce((status, name) => {
        status[name] = this.agents[name].getStatus();
        return status;
      }, {}),
      toolsRegistered: this.toolManager.getRegisteredTools(),
      memorySize: this.memorySystem.getSize()
    };
  }
}