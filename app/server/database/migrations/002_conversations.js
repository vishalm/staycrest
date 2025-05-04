/**
 * Migration: Create conversations table
 */
module.exports = {
  up: async (db) => {
    await db.createCollection('conversations', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['userId', 'isActive', 'createdAt', 'updatedAt'],
          properties: {
            userId: {
              bsonType: 'string',
              description: 'ID of the user who owns this conversation'
            },
            sessionId: {
              bsonType: 'string',
              description: 'Unique session identifier'
            },
            title: {
              bsonType: 'string',
              description: 'Conversation title'
            },
            messages: {
              bsonType: 'array',
              description: 'Messages in the conversation',
              items: {
                bsonType: 'object',
                required: ['role', 'content', 'timestamp'],
                properties: {
                  role: {
                    enum: ['user', 'assistant', 'system'],
                    description: 'Role of the message sender'
                  },
                  content: {
                    bsonType: 'string',
                    description: 'Message content'
                  },
                  timestamp: {
                    bsonType: 'date',
                    description: 'Message timestamp'
                  },
                  metadata: {
                    bsonType: 'object',
                    description: 'Additional message metadata'
                  }
                }
              }
            },
            entities: {
              bsonType: 'object',
              description: 'Extracted entities from the conversation'
            },
            searchHistoryIds: {
              bsonType: 'array',
              description: 'IDs of search history items associated with this conversation',
              items: {
                bsonType: 'string'
              }
            },
            isActive: {
              bsonType: 'bool',
              description: 'Whether the conversation is active'
            },
            expiresAt: {
              bsonType: 'date',
              description: 'Expiration date for conversation'
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

    // Create indexes
    await db.collection('conversations').createIndex({ userId: 1 });
    await db.collection('conversations').createIndex({ sessionId: 1 }, { unique: true });
    await db.collection('conversations').createIndex({ isActive: 1 });
    await db.collection('conversations').createIndex({ updatedAt: -1 });
    await db.collection('conversations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  },

  down: async (db) => {
    await db.collection('conversations').drop();
  }
}; 