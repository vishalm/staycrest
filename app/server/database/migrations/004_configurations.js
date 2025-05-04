/**
 * Migration: Create configurations table
 */
module.exports = {
  up: async (db) => {
    await db.createCollection('configurations', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'createdAt', 'updatedAt'],
          properties: {
            userId: {
              bsonType: 'string',
              description: 'ID of the user who owns this configuration'
            },
            preferredLoyaltyPrograms: {
              bsonType: 'array',
              description: 'User\'s preferred loyalty programs',
              items: {
                bsonType: 'string'
              }
            },
            defaultSearchParameters: {
              bsonType: 'object',
              description: 'Default parameters for searches'
            },
            uiPreferences: {
              bsonType: 'object',
              description: 'UI preferences',
              properties: {
                theme: {
                  enum: ['light', 'dark', 'system'],
                  description: 'UI theme preference'
                },
                fontSize: {
                  bsonType: 'string',
                  description: 'Font size preference'
                },
                language: {
                  bsonType: 'string',
                  description: 'Preferred language'
                },
                showHelpTips: {
                  bsonType: 'bool',
                  description: 'Whether to show help tips'
                },
                voiceEnabled: {
                  bsonType: 'bool',
                  description: 'Whether voice input/output is enabled'
                }
              }
            },
            sortingPreferences: {
              bsonType: 'object',
              description: 'Sorting preferences for hotel listings',
              properties: {
                sortBy: {
                  enum: ['price', 'rating', 'relevance', 'loyaltyValue'],
                  description: 'Primary sort field'
                },
                sortOrder: {
                  enum: ['asc', 'desc'],
                  description: 'Sort order'
                }
              }
            },
            notificationSettings: {
              bsonType: 'object',
              description: 'Notification settings',
              properties: {
                email: {
                  bsonType: 'bool',
                  description: 'Whether to send email notifications'
                },
                push: {
                  bsonType: 'bool',
                  description: 'Whether to send push notifications'
                },
                dealAlerts: {
                  bsonType: 'bool',
                  description: 'Whether to send deal alerts'
                }
              }
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp'
            },
            updatedAt: {
              bsonType: 'date',
              description: 'Last update timestamp'
            }
          }
        }
      }
    });

    // Create unique index for userId
    await db.collection('configurations').createIndex({ userId: 1 }, { unique: true });
  },

  down: async (db) => {
    await db.collection('configurations').drop();
  }
}; 