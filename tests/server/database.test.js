/**
 * Database Connection and Migration Tests
 */
const { MongoClient } = require('mongodb');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connection = require('../../server/database/connection');

// Mock migrations
const usersMigration = require('../../server/database/migrations/001_users');
const conversationsMigration = require('../../server/database/migrations/002_conversations');
const searchHistoryMigration = require('../../server/database/migrations/003_search_history');
const configurationsMigration = require('../../server/database/migrations/004_configurations');

describe('Database Connection', () => {
  let mongoServer;
  let mongoClient;
  let db;
  
  beforeAll(async () => {
    // Create an in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Set the MongoDB URI for the connection
    process.env.MONGODB_URI = mongoUri;
    
    // Connect to the in-memory database
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('test');
  });
  
  afterAll(async () => {
    // Clean up resources
    if (mongoClient) {
      await mongoClient.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    // Reset environment variables
    delete process.env.MONGODB_URI;
  });
  
  it('should connect to the database', async () => {
    // Test the connection module
    const dbConnection = await connection();
    expect(dbConnection).toBeDefined();
    expect(dbConnection.connection.readyState).toBe(1); // 1 means connected
    
    // Clean up mongoose connection
    await mongoose.disconnect();
  });
  
  describe('Database Migrations', () => {
    it('should apply users migration', async () => {
      // Apply the users migration
      await usersMigration.up(db);
      
      // Check if the collection was created
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      expect(collectionNames).toContain('users');
      
      // Check if indexes were created
      const indexes = await db.collection('users').indexes();
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('email_1');
      expect(indexNames).toContain('googleId_1');
      expect(indexNames).toContain('facebookId_1');
      expect(indexNames).toContain('firstName_1_lastName_1');
    });
    
    it('should apply conversations migration', async () => {
      // Apply the conversations migration
      await conversationsMigration.up(db);
      
      // Check if the collection was created
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      expect(collectionNames).toContain('conversations');
      
      // Check if indexes were created
      const indexes = await db.collection('conversations').indexes();
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('userId_1');
      expect(indexNames).toContain('sessionId_1');
      expect(indexNames).toContain('isActive_1');
      expect(indexNames).toContain('updatedAt_-1');
    });
    
    it('should apply search_history migration', async () => {
      // Apply the search_history migration
      await searchHistoryMigration.up(db);
      
      // Check if the collection was created
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      expect(collectionNames).toContain('search_history');
      
      // Check if indexes were created
      const indexes = await db.collection('search_history').indexes();
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('userId_1');
      expect(indexNames).toContain('createdAt_-1');
      expect(indexNames).toContain('isSaved_1');
    });
    
    it('should apply configurations migration', async () => {
      // Apply the configurations migration
      await configurationsMigration.up(db);
      
      // Check if the collection was created
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      expect(collectionNames).toContain('configurations');
      
      // Check if indexes were created
      const indexes = await db.collection('configurations').indexes();
      const indexNames = indexes.map(i => i.name);
      expect(indexNames).toContain('userId_1');
    });
    
    it('should rollback migrations', async () => {
      // Rollback all migrations
      await configurationsMigration.down(db);
      await searchHistoryMigration.down(db);
      await conversationsMigration.down(db);
      await usersMigration.down(db);
      
      // Check that collections were dropped
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      expect(collectionNames).not.toContain('users');
      expect(collectionNames).not.toContain('conversations');
      expect(collectionNames).not.toContain('search_history');
      expect(collectionNames).not.toContain('configurations');
    });
  });
}); 