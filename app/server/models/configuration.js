const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  preferredLoyaltyPrograms: {
    type: [String],
    default: [],
  },
  defaultSearchParameters: {
    location: String,
    guests: {
      type: Number,
      default: 2,
    },
    rooms: {
      type: Number,
      default: 1,
    },
    stayLength: {
      type: Number,
      default: 3,
    },
    filters: {
      amenities: [String],
      stars: {
        type: Number,
        min: 1,
        max: 5,
      },
      priceMin: Number,
      priceMax: Number,
      hotelChains: [String],
    },
  },
  uiPreferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system', 'hotel'],
      default: 'system',
    },
    fontSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium',
    },
    language: {
      type: String,
      default: 'en',
    },
    showPricesIn: {
      type: String,
      default: 'USD',
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY',
    },
  },
  voicePreferences: {
    enabled: {
      type: Boolean,
      default: true,
    },
    voiceId: String,
    speed: {
      type: Number,
      min: 0.5,
      max: 2.0,
      default: 1.0,
    },
    autoPlayResponses: {
      type: Boolean,
      default: false,
    },
    preferVoiceInput: {
      type: Boolean,
      default: false,
    },
  },
  notificationPreferences: {
    email: {
      enabled: {
        type: Boolean,
        default: true,
      },
      frequency: {
        type: String,
        enum: ['immediate', 'daily', 'weekly', 'never'],
        default: 'immediate',
      },
      types: {
        priceAlerts: {
          type: Boolean,
          default: true,
        },
        searchResults: {
          type: Boolean,
          default: true,
        },
        accountUpdates: {
          type: Boolean,
          default: true,
        },
      },
    },
    push: {
      enabled: {
        type: Boolean,
        default: false,
      },
      types: {
        priceAlerts: {
          type: Boolean,
          default: true,
        },
        searchResults: {
          type: Boolean,
          default: true,
        },
        accountUpdates: {
          type: Boolean,
          default: true,
        },
      },
    },
  },
  privacySettings: {
    saveSearchHistory: {
      type: Boolean,
      default: true,
    },
    saveConversations: {
      type: Boolean,
      default: true,
    },
    shareUsageData: {
      type: Boolean,
      default: false,
    },
    allowPersonalization: {
      type: Boolean,
      default: true,
    },
  },
  sortingPreferences: {
    defaultSort: {
      type: String,
      enum: ['price_asc', 'price_desc', 'rating_desc', 'recommendations', 'value'],
      default: 'recommendations',
    },
  },
  comparisonWeighting: {
    price: {
      type: Number,
      min: 1,
      max: 10,
      default: 7,
    },
    location: {
      type: Number,
      min: 1,
      max: 10,
      default: 6,
    },
    amenities: {
      type: Number,
      min: 1,
      max: 10,
      default: 5,
    },
    loyaltyBenefits: {
      type: Number,
      min: 1,
      max: 10,
      default: 8,
    },
    reviews: {
      type: Number,
      min: 1,
      max: 10,
      default: 6,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamps before saving
configurationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to get configuration (or create default if not exists)
configurationSchema.statics.getForUser = async function(userId) {
  let config = await this.findOne({ userId });
  
  if (!config) {
    config = await this.create({ userId });
  }
  
  return config;
};

// Method to update specific preferences
configurationSchema.methods.updatePreferences = async function(preferences) {
  // Deep merge the new preferences with existing ones
  Object.keys(preferences).forEach(key => {
    if (typeof preferences[key] === 'object' && preferences[key] !== null && !Array.isArray(preferences[key])) {
      this[key] = { ...this[key], ...preferences[key] };
    } else {
      this[key] = preferences[key];
    }
  });
  
  return this.save();
};

// Create model
const Configuration = mongoose.model('Configuration', configurationSchema);

module.exports = Configuration; 