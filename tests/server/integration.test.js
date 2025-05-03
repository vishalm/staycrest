/**
 * Server Integration Tests
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Import server components
const { app, server } = require('../../server/app');

// Import needed models
const User = require('../../server/models/user');
const Configuration = require('../../server/models/configuration');
const SearchHistory = require('../../server/models/search-history');

describe('Server Integration Tests', () => {
  let mongoServer;
  let agent;
  let testUserId;
  let testUserToken;
  let adminToken;
  
  beforeAll(async () => {
    // Create an in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Create supertest agent
    agent = request.agent(app);
    
    // Create test user and admin for testing auth-protected routes
    await createTestUsers();
  });
  
  afterAll(async () => {
    // Close open handles
    if (server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  /**
   * Create test users for authentication tests
   */
  async function createTestUsers() {
    // Create hashedPassword
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('TestPassword123', salt);
    const adminHashedPassword = await bcrypt.hash('AdminPassword123', salt);
    
    // Create a test user
    const testUser = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: hashedPassword,
      role: 'user',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create an admin user
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: adminHashedPassword,
      role: 'admin',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Save users
    const savedTestUser = await testUser.save();
    const savedAdminUser = await adminUser.save();
    
    // Store test user ID
    testUserId = savedTestUser._id.toString();
    
    // Create JWT tokens
    const secretKey = process.env.JWT_SECRET || 'test-secret-key';
    testUserToken = jwt.sign(
      { id: savedTestUser._id, role: 'user' },
      secretKey,
      { expiresIn: '1h' }
    );
    
    adminToken = jwt.sign(
      { id: savedAdminUser._id, role: 'admin' },
      secretKey,
      { expiresIn: '1h' }
    );
    
    // Create user configuration
    const config = new Configuration({
      userId: savedTestUser._id,
      preferredLoyaltyPrograms: ['marriott-bonvoy'],
      uiPreferences: {
        theme: 'light',
        language: 'en'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await config.save();
    
    // Create some search history items
    const search1 = new SearchHistory({
      userId: savedTestUser._id,
      query: 'Hotels in London',
      parameters: {
        location: 'London',
        checkIn: '2023-12-10',
        checkOut: '2023-12-15'
      },
      isSaved: true,
      savedName: 'London Trip',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    });
    
    const search2 = new SearchHistory({
      userId: savedTestUser._id,
      query: 'Hotels in Paris',
      parameters: {
        location: 'Paris',
        checkIn: '2024-01-15',
        checkOut: '2024-01-20'
      },
      isSaved: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    });
    
    await search1.save();
    await search2.save();
  }
  
  describe('Auth Routes', () => {
    it('should login a user with valid credentials', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
    });
    
    it('should reject login with invalid credentials', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        });
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
    
    it('should get current user information with a valid token', async () => {
      const response = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
    });
  });
  
  describe('User Routes', () => {
    it('should get user profile with a valid token', async () => {
      const response = await agent
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.preferences).toBeDefined();
    });
    
    it('should update user profile with a valid token', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };
      
      const response = await agent
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
    });
    
    it('should get saved searches with a valid token', async () => {
      const response = await agent
        .get('/api/user/saved-searches')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.savedSearches).toBeDefined();
      expect(response.body.data.savedSearches).toHaveLength(1); // One saved search
      expect(response.body.data.savedSearches[0].savedName).toBe('London Trip');
    });
    
    it('should reject requests without authentication', async () => {
      const response = await agent.get('/api/user/profile');
      
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('Search Routes', () => {
    it('should track a search query', async () => {
      const searchData = {
        query: 'Hotels in Berlin',
        parameters: {
          location: 'Berlin',
          checkIn: '2024-02-10',
          checkOut: '2024-02-15'
        }
      };
      
      const response = await agent
        .post('/api/search/track')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(searchData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.searchHistory).toBeDefined();
      expect(response.body.data.searchHistory.query).toBe(searchData.query);
    });
    
    it('should save a search query', async () => {
      const saveData = {
        searchId: null, // Will be filled in from the test
        name: 'Berlin Trip'
      };
      
      // First get a search ID
      const searchResponse = await agent
        .get('/api/user/recent-searches')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      // Find Berlin search
      const berlinSearch = searchResponse.body.data.recentSearches.find(
        search => search.query === 'Hotels in Berlin'
      );
      
      saveData.searchId = berlinSearch._id;
      
      // Now save it
      const response = await agent
        .post('/api/user/saved-searches')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(saveData);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.savedSearch).toBeDefined();
      expect(response.body.data.savedSearch.savedName).toBe(saveData.name);
      expect(response.body.data.savedSearch.isSaved).toBe(true);
    });
  });
  
  describe('Admin Routes', () => {
    it('should allow admins to access admin routes', async () => {
      const response = await agent
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject regular users from admin routes', async () => {
      const response = await agent
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${testUserToken}`);
      
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });
}); 