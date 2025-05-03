/**
 * Database Models Tests
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../../server/models/user');
const Conversation = require('../../server/models/conversation');
const SearchHistory = require('../../server/models/search-history');
const Configuration = require('../../server/models/configuration');

describe('Database Models', () => {
  let mongoServer;
  
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
  });
  
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  describe('User Model', () => {
    it('should create and save a user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'hashedPassword123',
        role: 'user',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const user = new User(userData);
      const savedUser = await user.save();
      
      // Verify saved user
      expect(savedUser._id).toBeDefined();
      expect(savedUser.firstName).toBe(userData.firstName);
      expect(savedUser.lastName).toBe(userData.lastName);
      expect(savedUser.email).toBe(userData.email);
      expect(savedUser.role).toBe(userData.role);
    });
    
    it('should fail when required fields are missing', async () => {
      const user = new User({
        firstName: 'Jane',
        lastName: 'Doe'
        // Missing required fields: email, role, isVerified
      });
      
      let err;
      try {
        await user.save();
      } catch (error) {
        err = error;
      }
      
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    });
    
    it('should add loyalty accounts to user', async () => {
      const user = new User({
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob.smith@example.com',
        password: 'hashedPassword456',
        role: 'user',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await user.save();
      
      // Add loyalty account
      user.loyaltyAccounts.push({
        programId: 'marriott-bonvoy',
        programName: 'Marriott Bonvoy',
        membershipId: 'MB123456',
        tier: 'Gold',
        points: 50000,
        lastUpdated: new Date()
      });
      
      const updatedUser = await user.save();
      
      // Verify loyalty account was added
      expect(updatedUser.loyaltyAccounts).toHaveLength(1);
      expect(updatedUser.loyaltyAccounts[0].programId).toBe('marriott-bonvoy');
      expect(updatedUser.loyaltyAccounts[0].tier).toBe('Gold');
    });
    
    afterEach(async () => {
      await User.deleteMany({});
    });
  });
  
  describe('Conversation Model', () => {
    let testUser;
    
    beforeEach(async () => {
      // Create a test user for conversations
      testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test.user@example.com',
        password: 'hashedPassword789',
        role: 'user',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await testUser.save();
    });
    
    it('should create and save a conversation successfully', async () => {
      const conversationData = {
        userId: testUser._id,
        sessionId: 'session123',
        title: 'Test Conversation',
        isActive: true,
        messages: [
          {
            role: 'user',
            content: 'Hello, system!',
            timestamp: new Date()
          },
          {
            role: 'assistant',
            content: 'Hello! How can I help you today?',
            timestamp: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const conversation = new Conversation(conversationData);
      const savedConversation = await conversation.save();
      
      // Verify saved conversation
      expect(savedConversation._id).toBeDefined();
      expect(savedConversation.userId.toString()).toBe(testUser._id.toString());
      expect(savedConversation.title).toBe(conversationData.title);
      expect(savedConversation.messages).toHaveLength(2);
    });
    
    it('should fail when required fields are missing', async () => {
      const conversation = new Conversation({
        title: 'Incomplete Conversation'
        // Missing required fields: userId, isActive
      });
      
      let err;
      try {
        await conversation.save();
      } catch (error) {
        err = error;
      }
      
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    });
    
    afterEach(async () => {
      await Conversation.deleteMany({});
      await User.deleteMany({});
    });
  });
  
  describe('SearchHistory Model', () => {
    let testUser;
    
    beforeEach(async () => {
      // Create a test user for search history
      testUser = new User({
        firstName: 'Search',
        lastName: 'User',
        email: 'search.user@example.com',
        password: 'hashedPasswordABC',
        role: 'user',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await testUser.save();
    });
    
    it('should create and save search history successfully', async () => {
      const searchData = {
        userId: testUser._id,
        query: 'hotels in new york',
        parameters: {
          location: 'New York',
          checkIn: '2023-12-15',
          checkOut: '2023-12-20',
          guests: 2
        },
        loyaltyPrograms: ['marriott-bonvoy', 'hilton-honors'],
        isSaved: true,
        savedName: 'NYC December Trip',
        createdAt: new Date()
      };
      
      const searchHistory = new SearchHistory(searchData);
      const savedSearch = await searchHistory.save();
      
      // Verify saved search
      expect(savedSearch._id).toBeDefined();
      expect(savedSearch.userId.toString()).toBe(testUser._id.toString());
      expect(savedSearch.query).toBe(searchData.query);
      expect(savedSearch.loyaltyPrograms).toHaveLength(2);
      expect(savedSearch.isSaved).toBe(true);
    });
    
    it('should fail when required fields are missing', async () => {
      const searchHistory = new SearchHistory({
        // Missing required fields: userId, query
        parameters: {
          location: 'Paris',
          checkIn: '2024-01-10',
          checkOut: '2024-01-15'
        }
      });
      
      let err;
      try {
        await searchHistory.save();
      } catch (error) {
        err = error;
      }
      
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    });
    
    afterEach(async () => {
      await SearchHistory.deleteMany({});
      await User.deleteMany({});
    });
  });
  
  describe('Configuration Model', () => {
    let testUser;
    
    beforeEach(async () => {
      // Create a test user for configuration
      testUser = new User({
        firstName: 'Config',
        lastName: 'User',
        email: 'config.user@example.com',
        password: 'hashedPasswordXYZ',
        role: 'user',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await testUser.save();
    });
    
    it('should create and save configuration successfully', async () => {
      const configData = {
        userId: testUser._id,
        preferredLoyaltyPrograms: ['marriott-bonvoy', 'world-of-hyatt'],
        defaultSearchParameters: {
          adults: 2,
          children: 0,
          rooms: 1
        },
        uiPreferences: {
          theme: 'dark',
          fontSize: 'medium',
          language: 'en',
          showHelpTips: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const configuration = new Configuration(configData);
      const savedConfig = await configuration.save();
      
      // Verify saved configuration
      expect(savedConfig._id).toBeDefined();
      expect(savedConfig.userId.toString()).toBe(testUser._id.toString());
      expect(savedConfig.preferredLoyaltyPrograms).toHaveLength(2);
      expect(savedConfig.uiPreferences.theme).toBe('dark');
    });
    
    it('should fail when required fields are missing', async () => {
      const configuration = new Configuration({
        // Missing required field: userId
        uiPreferences: {
          theme: 'light'
        }
      });
      
      let err;
      try {
        await configuration.save();
      } catch (error) {
        err = error;
      }
      
      expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    });
    
    afterEach(async () => {
      await Configuration.deleteMany({});
      await User.deleteMany({});
    });
  });
}); 