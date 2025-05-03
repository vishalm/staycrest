/**
 * Migration: Create search_history table
 */
module.exports = {
  up: async (db) => {
    await db.createCollection('search_history', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'query', 'createdAt'],
          properties: {
            userId: {
              bsonType: 'string',
              description: 'ID of the user who performed the search'
            },
            query: {
              bsonType: 'string',
              description: 'Search query text'
            },
            parameters: {
              bsonType: 'object',
              description: 'Search parameters used'
            },
            loyaltyPrograms: {
              bsonType: 'array',
              description: 'Loyalty programs included in the search',
              items: {
                bsonType: 'string'
              }
            },
            results: {
              bsonType: 'array',
              description: 'Search results',
              items: {
                bsonType: 'object'
              }
            },
            isSaved: {
              bsonType: 'bool',
              description: 'Whether the search is saved by the user'
            },
            savedName: {
              bsonType: 'string',
              description: 'User-friendly name for the saved search'
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp'
            }
          }
        }
      }
    });

    // Create indexes
    await db.collection('search_history').createIndex({ userId: 1 });
    await db.collection('search_history').createIndex({ createdAt: -1 });
    await db.collection('search_history').createIndex({ isSaved: 1 });
    
    // Text index for search
    await db.collection('search_history').createIndex(
      { query: 'text', savedName: 'text' },
      { weights: { query: 2, savedName: 5 } }
    );
  },

  down: async (db) => {
    await db.collection('search_history').drop();
  }
}; 