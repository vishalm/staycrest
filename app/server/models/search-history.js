const mongoose = require('mongoose');

const searchHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  query: {
    type: String,
    required: true,
  },
  parameters: {
    location: {
      type: String,
    },
    checkIn: {
      type: Date,
    },
    checkOut: {
      type: Date,
    },
    guests: {
      type: Number,
    },
    rooms: {
      type: Number,
    },
    filters: {
      amenities: [String],
      stars: Number,
      priceMin: Number,
      priceMax: Number,
      hotelChains: [String],
    },
  },
  loyaltyPrograms: {
    type: [String],
    default: [],
  },
  results: {
    count: {
      type: Number,
    },
    hotels: [{
      hotelId: String,
      name: String,
      chain: String,
      loyaltyProgram: String,
      price: Number,
      pointsRequired: Number,
      link: String,
    }],
  },
  isSaved: {
    type: Boolean,
    default: false,
  },
  schedule: {
    enabled: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: false,
      },
    },
    lastRun: {
      type: Date,
    },
    nextRun: {
      type: Date,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Create index for the most common query patterns
searchHistorySchema.index({ userId: 1, createdAt: -1 });
searchHistorySchema.index({ userId: 1, isSaved: 1 });
searchHistorySchema.index({ 'schedule.enabled': 1, 'schedule.nextRun': 1 }, { 
  partialFilterExpression: { 'schedule.enabled': true } 
});

// Add method to save a search as a favorite
searchHistorySchema.methods.saveSearch = async function() {
  this.isSaved = true;
  return this.save();
};

// Add method to convert a search history to a scheduled search
searchHistorySchema.methods.convertToScheduledSearch = async function(scheduleOptions) {
  this.isSaved = true;
  this.schedule = {
    ...scheduleOptions,
    enabled: true,
    lastRun: new Date(),
    nextRun: calculateNextRun(scheduleOptions.frequency),
  };
  return this.save();
};

// Helper function to calculate the next run date based on frequency
function calculateNextRun(frequency) {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.setDate(now.getDate() + 1));
    case 'weekly':
      return new Date(now.setDate(now.getDate() + 7));
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    default:
      return new Date(now.setDate(now.getDate() + 1));
  }
}

// Static method to find searches that need to be executed
searchHistorySchema.statics.findScheduledToRun = function() {
  const now = new Date();
  return this.find({
    'schedule.enabled': true,
    'schedule.nextRun': { $lte: now },
  });
};

// Create model
const SearchHistory = mongoose.model('SearchHistory', searchHistorySchema);

module.exports = SearchHistory; 