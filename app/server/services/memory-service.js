const Conversation = require('../models/conversation');
const SearchHistory = require('../models/search-history');
const Configuration = require('../models/configuration');
const User = require('../models/user');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/memory.log' })
  ],
});

/**
 * Memory Service - Manages conversation context and memory for agent interactions
 */
class MemoryService {
  /**
   * Store a new message in the conversation
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Object} message - Message object (role, content, metadata)
   * @returns {Promise<Object>} - Updated conversation
   */
  async storeMessage(userId, sessionId, message) {
    try {
      // Find or create conversation
      let conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        conversation = await Conversation.create({
          userId,
          sessionId,
          messages: [],
        });
      }
      
      // Add message to conversation
      await conversation.addMessage(message);
      
      return conversation;
    } catch (error) {
      logger.error(`Error storing message: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get conversation history
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Number} limit - Maximum number of messages to return
   * @returns {Promise<Array>} - Conversation messages
   */
  async getConversationHistory(userId, sessionId, limit = 20) {
    try {
      const conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        return [];
      }
      
      // Return the latest messages up to limit
      return conversation.messages.slice(-limit);
    } catch (error) {
      logger.error(`Error getting conversation history: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extract and store entities from message content
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Object} entities - Object containing extracted entities
   * @returns {Promise<Object>} - Updated conversation
   */
  async storeEntities(userId, sessionId, entities) {
    try {
      const conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        return null;
      }
      
      await conversation.addEntities(entities);
      return conversation;
    } catch (error) {
      logger.error(`Error storing entities: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Link a search to a conversation
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID 
   * @param {String} searchHistoryId - Search history ID
   * @returns {Promise<Object>} - Updated conversation
   */
  async linkSearchToConversation(userId, sessionId, searchHistoryId) {
    try {
      const conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        return null;
      }
      
      await conversation.addSearchHistory(searchHistoryId);
      return conversation;
    } catch (error) {
      logger.error(`Error linking search to conversation: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get all relevant user context for personalization
   * @param {String} userId - User ID 
   * @returns {Promise<Object>} - User context
   */
  async getUserContext(userId) {
    try {
      // Get user info
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }
      
      // Get user configuration
      const configuration = await Configuration.getForUser(userId);
      
      // Get recent searches (last 5)
      const recentSearches = await SearchHistory.find({ userId })
        .sort({ createdAt: -1 })
        .limit(5);
      
      // Get saved searches
      const savedSearches = await SearchHistory.find({ userId, isSaved: true })
        .sort({ createdAt: -1 });
      
      // Construct user context
      return {
        user: {
          name: user.fullName,
          loyaltyAccounts: user.loyaltyAccounts || [],
        },
        preferences: {
          preferredLoyaltyPrograms: configuration.preferredLoyaltyPrograms || [],
          defaultSearchParameters: configuration.defaultSearchParameters || {},
          uiPreferences: configuration.uiPreferences || {},
          sortingPreferences: configuration.sortingPreferences || {},
        },
        recentActivity: {
          searches: recentSearches.map(s => ({
            query: s.query,
            parameters: s.parameters,
            date: s.createdAt,
          })),
          savedSearches: savedSearches.map(s => ({
            id: s._id,
            query: s.query,
            parameters: s.parameters,
          })),
        },
      };
    } catch (error) {
      logger.error(`Error getting user context: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Archive a conversation (mark as inactive)
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @returns {Promise<Boolean>} - Success status
   */
  async archiveConversation(userId, sessionId) {
    try {
      const conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        return false;
      }
      
      await conversation.archive();
      return true;
    } catch (error) {
      logger.error(`Error archiving conversation: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Extend conversation expiration
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @param {Number} days - Days to extend
   * @returns {Promise<Date>} - New expiration date
   */
  async extendConversationExpiration(userId, sessionId, days = 30) {
    try {
      const conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        return null;
      }
      
      await conversation.extendExpiration(days);
      return conversation.expiresAt;
    } catch (error) {
      logger.error(`Error extending conversation expiration: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get all active conversations for a user
   * @param {String} userId - User ID
   * @returns {Promise<Array>} - Active conversations
   */
  async getActiveConversations(userId) {
    try {
      return await Conversation.find({ 
        userId, 
        isActive: true 
      }).sort({ updatedAt: -1 });
    } catch (error) {
      logger.error(`Error getting active conversations: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get a summary of a conversation
   * @param {String} userId - User ID
   * @param {String} sessionId - Session ID
   * @returns {Promise<Object>} - Conversation summary
   */
  async getConversationSummary(userId, sessionId) {
    try {
      const conversation = await Conversation.findOne({ userId, sessionId });
      
      if (!conversation) {
        return null;
      }
      
      // Get message count
      const messageCount = conversation.messages.length;
      
      // Get first and last message dates
      const firstMessage = conversation.messages[0];
      const lastMessage = conversation.messages[messageCount - 1];
      
      // Get associated searches
      const searches = await SearchHistory.find({
        _id: { $in: conversation.searchHistoryIds }
      });
      
      return {
        id: conversation._id,
        title: conversation.title,
        messageCount,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        firstMessageDate: firstMessage?.timestamp,
        lastMessageDate: lastMessage?.timestamp,
        entities: conversation.entities,
        associatedSearches: searches.map(s => ({
          id: s._id,
          query: s.query,
          date: s.createdAt,
        })),
      };
    } catch (error) {
      logger.error(`Error getting conversation summary: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MemoryService(); 