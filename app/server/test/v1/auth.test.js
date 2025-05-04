const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../app');
const User = require('../../models/user');

// API version prefix
const API_PREFIX = '/api/v1';

// Mock data
const testUser = {
  email: 'test@example.com',
  password: 'Password123!',
  firstName: 'Test',
  lastName: 'User'
};

let token;
let userId;

// Before running tests, connect to a test database
beforeAll(async () => {
  const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/staycrest_test';
  await mongoose.connect(mongoUri);
  
  // Clear users collection
  await User.deleteMany({});
});

// After all tests, disconnect from database
afterAll(async () => {
  await mongoose.connection.close();
});

describe('Authentication API (v1)', () => {
  // Test API version info endpoint
  describe(`GET ${API_PREFIX}`, () => {
    it('should return API version information', async () => {
      const res = await request(app).get(API_PREFIX);
      
      expect(res.status).toBe(200);
      expect(res.body.apiVersion).toBe('1');
      expect(res.body.endpoints).toContain('/auth');
    });
  });

  // Test user registration
  describe(`POST ${API_PREFIX}/auth/register`, () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send(testUser);
      
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      
      // Save token and userId for later tests
      token = res.body.token;
      userId = res.body.user.id;
    });
    
    it('should not register a user with an existing email', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send(testUser);
      
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toBe('Email already in use');
    });
    
    it('should not register a user with invalid data', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'invalid-email',
          password: '123', // Too short
        });
      
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });
  
  // Test user login
  describe(`POST ${API_PREFIX}/auth/login`, () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email);
      
      // Update token
      token = res.body.token;
    });
    
    it('should not login with invalid credentials', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
    
    it('should not login with non-existent email', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });
  
  // Test getting current user
  describe(`GET ${API_PREFIX}/auth/me`, () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
    });
    
    it('should not return user without token', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/auth/me`);
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
    
    it('should not return user with invalid token', async () => {
      const res = await request(app)
        .get(`${API_PREFIX}/auth/me`)
        .set('Authorization', 'Bearer invalidtoken');
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });
  
  // Test updating user details
  describe(`PUT ${API_PREFIX}/auth/update-details`, () => {
    it('should update user details with valid token', async () => {
      const updatedDetails = {
        firstName: 'Updated',
        lastName: 'Name'
      };
      
      const res = await request(app)
        .put(`${API_PREFIX}/auth/update-details`)
        .set('Authorization', `Bearer ${token}`)
        .send(updatedDetails);
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.firstName).toBe(updatedDetails.firstName);
      expect(res.body.data.user.lastName).toBe(updatedDetails.lastName);
    });
    
    it('should not update user details without token', async () => {
      const res = await request(app)
        .put(`${API_PREFIX}/auth/update-details`)
        .send({
          firstName: 'Another',
          lastName: 'Update'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });
  
  // Test updating password
  describe(`PUT ${API_PREFIX}/auth/update-password`, () => {
    it('should update password with valid current password', async () => {
      const res = await request(app)
        .put(`${API_PREFIX}/auth/update-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPassword123!'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.token).toBeDefined();
      
      // Update token
      token = res.body.token;
      
      // Update testUser for future tests
      testUser.password = 'NewPassword123!';
    });
    
    it('should not update password with invalid current password', async () => {
      const res = await request(app)
        .put(`${API_PREFIX}/auth/update-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'AnotherNewPassword123!'
        });
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });
  
  // Test logout
  describe(`POST ${API_PREFIX}/auth/logout`, () => {
    it('should logout successfully with valid token', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/logout`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
    
    it('should handle logout without token', async () => {
      const res = await request(app)
        .post(`${API_PREFIX}/auth/logout`);
      
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });
  });
  
  // Test API versioning via headers
  describe('API versioning via headers', () => {
    it('should access v1 endpoint via Accept-Version header', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Accept-Version', 'v1')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
    
    it('should access v1 endpoint via X-API-Version header', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-API-Version', 'v1')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
  
  // Test API versioning via query parameter
  describe('API versioning via query parameter', () => {
    it('should access v1 endpoint via version query parameter', async () => {
      const res = await request(app)
        .post('/api/auth/login?version=1')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
}); 