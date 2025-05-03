const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: {
    type: Object,
    default: {},
  },
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  messages: [messageSchema],
  title: {
    type: String,
    default: 'New Conversation',
  },
  entities: {
    locations: [String],
    hotels: [String],
    dates: [Date],
    loyaltyPrograms: [String],
    preferences: [String],
  },
  context: {
    type: Object,
    default: {},
  },
  searchHistoryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SearchHistory',
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Conversations expire after 30 days by default
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date;
    },
  },
});

// Create index for common query patterns
conversationSchema.index({ userId: 1, updatedAt: -1 });
conversationSchema.index({ userId: 1, isActive: 1 });
conversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-expiry

// Update the updatedAt field before saving
conversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add a message to the conversation
conversationSchema.methods.addMessage = function(message) {
  this.messages.push(message);
  this.updatedAt = Date.now();
  return this.save();
};

// Method to add extracted entities to the conversation
conversationSchema.methods.addEntities = function(extractedEntities) {
  // Merge the extracted entities with existing ones, avoiding duplicates
  Object.keys(extractedEntities).forEach(entityType => {
    if (this.entities[entityType]) {
      const existingEntities = new Set(this.entities[entityType]);
      extractedEntities[entityType].forEach(entity => existingEntities.add(entity));
      this.entities[entityType] = [...existingEntities];
    } else {
      this.entities[entityType] = extractedEntities[entityType];
    }
  });
  
  return this.save();
};

// Method to associate a search with the conversation
conversationSchema.methods.addSearchHistory = function(searchHistoryId) {
  if (!this.searchHistoryIds.includes(searchHistoryId)) {
    this.searchHistoryIds.push(searchHistoryId);
  }
  return this.save();
};

// Method to archive a conversation
conversationSchema.methods.archive = function() {
  this.isActive = false;
  return this.save();
};

// Method to extend the expiration time
conversationSchema.methods.extendExpiration = function(days = 30) {
  const newExpiryDate = new Date();
  newExpiryDate.setDate(newExpiryDate.getDate() + days);
  this.expiresAt = newExpiryDate;
  return this.save();
};

// Helper method to get the most recent messages as context (for LLM)
conversationSchema.methods.getRecentContext = function(messageCount = 10) {
  return this.messages.slice(-messageCount);
};

// Create model
const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation; 