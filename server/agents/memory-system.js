const Conversation = require('../models/conversation');
const SearchHistory = require('../models/search-history');
const Configuration = require('../models/configuration');

/**
 * Memory System for storing and retrieving conversation context
 */
class MemorySystem {
  constructor() {
    this.shortTermMemory = new Map();
    this.shortTermTTL = 30 * 60 * 1000; // 30 minutes
    this.maxShortTermSize = 100;
  }
  
  /**
   * Store a memory in the system
   * @param {Object} memory - Memory object to store 
   * @returns {Promise<Object>} Stored memory
   */
  async store(memory) {
    try {
      // Add timestamp if not present
      if (!memory.timestamp) {
        memory.timestamp = new Date();
      }
      
      // Store in short-term memory
      const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      this.shortTermMemory.set(memoryId, {
        ...memory,
        id: memoryId,
        expires: Date.now() + this.shortTermTTL
      });
      
      // Clean up old memories if needed
      this.cleanupShortTermMemory();
      
      // If the memory contains a userId and conversationId, store in database
      if (memory.userId && memory.sessionId) {
        await this.storeLongTermMemory(memory);
      }
      
      return { ...memory, id: memoryId };
    } catch (error) {
      console.error('Error storing memory:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve memories relevant to a query
   * @param {string} query - The query to find relevant memories for
   * @param {Object} options - Additional retrieval options
   * @returns {Promise<Array>} Relevant memories
   */
  async retrieve(query, options = {}) {
    try {
      const retrievalOptions = {
        userId: null,
        sessionId: null,
        limit: 10,
        includeShortTerm: true,
        includeLongTerm: true,
        ...options
      };
      
      let relevantMemories = [];
      
      // Get short-term memories
      if (retrievalOptions.includeShortTerm) {
        const shortTermMemories = this.retrieveFromShortTerm(query);
        relevantMemories = relevantMemories.concat(shortTermMemories);
      }
      
      // Get long-term memories if user context is available
      if (retrievalOptions.includeLongTerm && retrievalOptions.userId) {
        const longTermMemories = await this.retrieveFromLongTerm(
          query, 
          retrievalOptions.userId,
          retrievalOptions.sessionId
        );
        relevantMemories = relevantMemories.concat(longTermMemories);
      }
      
      // Sort by relevance and limit
      return this.rankAndLimitMemories(relevantMemories, query, retrievalOptions.limit);
    } catch (error) {
      console.error('Error retrieving memories:', error);
      return [];
    }
  }
  
  /**
   * Store memory in the database (long-term)
   * @param {Object} memory - Memory to store
   * @returns {Promise<void>}
   */
  async storeLongTermMemory(memory) {
    try {
      // If memory is a conversation message
      if (memory.role && memory.content) {
        await Conversation.findOneAndUpdate(
          { userId: memory.userId, sessionId: memory.sessionId },
          { 
            $push: { messages: {
              role: memory.role,
              content: memory.content,
              timestamp: memory.timestamp,
              metadata: memory.metadata || {}
            }},
            $set: { updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true, new: true }
        );
      }
      
      // If memory is a search result
      if (memory.query && memory.results) {
        const searchHistory = new SearchHistory({
          userId: memory.userId,
          query: memory.query,
          parameters: memory.parameters || {},
          loyaltyPrograms: memory.loyaltyPrograms || [],
          results: memory.results,
          createdAt: memory.timestamp
        });
        
        await searchHistory.save();
        
        // Link search to conversation if sessionId exists
        if (memory.sessionId) {
          await Conversation.findOneAndUpdate(
            { userId: memory.userId, sessionId: memory.sessionId },
            { $push: { searchHistoryIds: searchHistory._id } }
          );
        }
      }
      
      // If memory contains entities
      if (memory.entities) {
        await Conversation.findOneAndUpdate(
          { userId: memory.userId, sessionId: memory.sessionId },
          { $set: { entities: this.mergeEntities(memory.entities) } }
        );
      }
    } catch (error) {
      console.error('Error storing long-term memory:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve memories from short-term memory
   * @param {string} query - The query to find relevant memories for
   * @returns {Array} Relevant short-term memories
   */
  retrieveFromShortTerm(query) {
    const currentTime = Date.now();
    const memories = [];
    
    // Filter out expired memories
    for (const [id, memory] of this.shortTermMemory.entries()) {
      if (memory.expires < currentTime) {
        this.shortTermMemory.delete(id);
        continue;
      }
      
      memories.push(memory);
    }
    
    // Calculate relevance score for each memory
    return memories.map(memory => ({
      ...memory,
      relevanceScore: this.calculateRelevance(query, memory)
    }));
  }
  
  /**
   * Retrieve memories from long-term memory (database)
   * @param {string} query - The query to find relevant memories for
   * @param {string} userId - User ID
   * @param {string} sessionId - Current session ID
   * @returns {Promise<Array>} Relevant long-term memories
   */
  async retrieveFromLongTerm(query, userId, sessionId) {
    const memories = [];
    
    try {
      // Get relevant conversation messages
      const conversation = await Conversation.findOne(
        { userId, sessionId }
      ).sort({ updatedAt: -1 });
      
      if (conversation) {
        // Get the most recent messages
        const recentMessages = conversation.messages.slice(-10);
        
        // Add to memories
        recentMessages.forEach(message => {
          memories.push({
            id: `conv_${conversation._id}_${message._id}`,
            text: message.content,
            timestamp: message.timestamp,
            role: message.role,
            type: 'conversation',
            source: 'long-term',
          });
        });
        
        // Get entities from this conversation
        if (conversation.entities) {
          Object.entries(conversation.entities).forEach(([entityType, entities]) => {
            entities.forEach(entity => {
              memories.push({
                id: `entity_${entityType}_${entity}`,
                text: `User is interested in ${entityType}: ${entity}`,
                timestamp: conversation.updatedAt,
                type: 'entity',
                entityType,
                entity,
                source: 'long-term',
              });
            });
          });
        }
      }
      
      // Get relevant searches
      const searches = await SearchHistory.find(
        { userId }
      ).sort({ createdAt: -1 }).limit(5);
      
      searches.forEach(search => {
        memories.push({
          id: `search_${search._id}`,
          text: `User searched for: ${search.query}`,
          timestamp: search.createdAt,
          query: search.query,
          parameters: search.parameters,
          type: 'search',
          source: 'long-term',
        });
      });
      
      // Get user preferences
      const config = await Configuration.findOne({ userId });
      
      if (config) {
        const preferredPrograms = config.preferredLoyaltyPrograms || [];
        if (preferredPrograms.length > 0) {
          memories.push({
            id: `prefs_loyalty`,
            text: `User's preferred loyalty programs: ${preferredPrograms.join(', ')}`,
            timestamp: config.updatedAt,
            type: 'preference',
            preferenceType: 'loyalty',
            source: 'long-term',
          });
        }
        
        // Add other preferences as needed
        if (config.defaultSearchParameters) {
          memories.push({
            id: `prefs_search`,
            text: `User's default search parameters: ${JSON.stringify(config.defaultSearchParameters)}`,
            timestamp: config.updatedAt,
            type: 'preference',
            preferenceType: 'search',
            source: 'long-term',
          });
        }
      }
      
      // Calculate relevance scores
      return memories.map(memory => ({
        ...memory,
        relevanceScore: this.calculateRelevance(query, memory)
      }));
    } catch (error) {
      console.error('Error retrieving from long-term memory:', error);
      return [];
    }
  }
  
  /**
   * Calculate relevance score between query and a memory
   * @param {string} query - The search query
   * @param {Object} memory - Memory to evaluate
   * @returns {number} Relevance score (0-100)
   */
  calculateRelevance(query, memory) {
    // Simple relevance calculation based on text similarity
    // In a production system, this would use vector similarity or more advanced metrics
    let score = 0;
    const queryTerms = query.toLowerCase().split(' ');
    
    // Get memory text content
    const memoryText = memory.text || 
                      memory.content || 
                      memory.query || 
                      JSON.stringify(memory);
    
    // Count matching terms
    queryTerms.forEach(term => {
      if (memoryText.toLowerCase().includes(term)) {
        score += 10;
      }
    });
    
    // Boosting factors
    
    // Recency boost (newer = more relevant)
    const ageInHours = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 20 - (ageInHours / 24) * 20); // 20 points reduced to 0 over 24 hours
    score += recencyScore;
    
    // Type-specific boosts
    switch (memory.type) {
      case 'entity':
        score += 15; // Entities are highly relevant
        break;
      case 'conversation':
        if (memory.role === 'user') {
          score += 10; // User messages slightly more important
        }
        break;
      case 'search':
        score += 20; // Searches are very relevant
        break;
      case 'preference':
        score += 25; // Preferences are extremely relevant
        break;
    }
    
    return score;
  }
  
  /**
   * Rank and limit memories by relevance score
   * @param {Array} memories - Memories to rank
   * @param {string} query - Original query
   * @param {number} limit - Maximum number to return
   * @returns {Array} Top ranked memories
   */
  rankAndLimitMemories(memories, query, limit) {
    // Sort by relevance score (descending)
    const sortedMemories = memories.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Return top N results
    return sortedMemories.slice(0, limit);
  }
  
  /**
   * Clean up old short-term memories
   */
  cleanupShortTermMemory() {
    const currentTime = Date.now();
    let deletedCount = 0;
    
    // Remove expired memories
    for (const [id, memory] of this.shortTermMemory.entries()) {
      if (memory.expires < currentTime) {
        this.shortTermMemory.delete(id);
        deletedCount++;
      }
    }
    
    // If still over capacity, remove oldest memories
    if (this.shortTermMemory.size > this.maxShortTermSize) {
      const memoriesByAge = Array.from(this.shortTermMemory.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const excessCount = this.shortTermMemory.size - this.maxShortTermSize;
      for (let i = 0; i < excessCount; i++) {
        this.shortTermMemory.delete(memoriesByAge[i][0]);
        deletedCount++;
      }
    }
    
    return deletedCount;
  }
  
  /**
   * Merge entity objects
   * @param {Object} newEntities - New entities to merge
   * @returns {Object} Merged entities
   */
  mergeEntities(newEntities, existingEntities = {}) {
    const merged = { ...existingEntities };
    
    Object.entries(newEntities).forEach(([type, entities]) => {
      if (!merged[type]) {
        merged[type] = [];
      }
      
      // Add new entities, avoiding duplicates
      entities.forEach(entity => {
        if (!merged[type].includes(entity)) {
          merged[type].push(entity);
        }
      });
    });
    
    return merged;
  }
  
  /**
   * Get memory system size
   */
  getSize() {
    return {
      shortTerm: this.shortTermMemory.size,
      // Could add database stats here
    };
  }
  
  /**
   * Clear short-term memory
   */
  clearShortTermMemory() {
    const size = this.shortTermMemory.size;
    this.shortTermMemory.clear();
    return size;
  }
}

module.exports = MemorySystem; 