/**
 * StayCrest Simple Server API Tests
 * 
 * Tests for the simplified StayCrest server API endpoints.
 */

const http = require('http');
const { once } = require('events');

// Mock the server without actually starting it
jest.mock('http', () => {
  const originalModule = jest.requireActual('http');
  
  return {
    ...originalModule,
    createServer: jest.fn(() => ({
      listen: jest.fn(() => ({ close: jest.fn() })),
      close: jest.fn()
    }))
  };
});

describe('StayCrest Server API', () => {
  let server;
  let requestListener;
  let mockResponse;
  
  beforeEach(() => {
    // Clear previous mocks
    jest.clearAllMocks();
    
    // Mock response object
    mockResponse = {
      setHeader: jest.fn(),
      statusCode: 200,
      end: jest.fn()
    };
    
    // Get the request listener function
    http.createServer.mockImplementation((listener) => {
      requestListener = listener;
      server = {
        listen: jest.fn(() => server),
        close: jest.fn()
      };
      return server;
    });
    
    // Import the server module to trigger createServer
    jest.isolateModules(() => {
      require('../../server.js');
    });
  });
  
  afterEach(() => {
    jest.resetModules();
  });
  
  describe('Static File Serving', () => {
    test('should serve index.html for root URL', () => {
      // Mock fs.readFile to simulate reading index.html
      jest.mock('fs', () => ({
        readFile: (path, callback) => {
          callback(null, '<html>Mock index.html</html>');
        }
      }));
      
      // Create a mock request
      const req = { 
        method: 'GET', 
        url: '/' 
      };
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check if response was correctly set
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(mockResponse.statusCode).toBe(200);
    });
  });
  
  describe('API Endpoints', () => {
    test('should handle /api/search requests', () => {
      // Create a mock GET search request
      const req = { 
        method: 'GET', 
        url: '/api/search?q=test&location=New%20York'
      };
      
      // Mock the response end to capture JSON output
      mockResponse.end.mockImplementation((data) => {
        const responseData = JSON.parse(data);
        
        // Validate response structure
        expect(responseData.status).toBe('success');
        expect(responseData.data.query).toBe('test');
        expect(Array.isArray(responseData.data.hotels)).toBe(true);
      });
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check response headers
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });
    
    test('should handle /api/chat POST requests', async () => {
      // Create a mock POST chat request
      const req = {
        method: 'POST',
        url: '/api/chat',
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('{"message":"Hello, test message","sessionId":"test-session"}'));
          }
          if (event === 'end') {
            handler();
          }
        })
      };
      
      // Mock the response end to capture JSON output
      mockResponse.end.mockImplementation((data) => {
        const responseData = JSON.parse(data);
        
        // Validate response structure
        expect(responseData.status).toBe('success');
        expect(responseData.data.response).toBeDefined();
        expect(responseData.data.sessionId).toBe('test-session');
      });
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check response headers
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
    });
    
    test('should handle /api/loyalty/programs GET requests', () => {
      // Create a mock loyalty programs request
      const req = {
        method: 'GET',
        url: '/api/loyalty/programs'
      };
      
      // Mock the response end to capture JSON output
      mockResponse.end.mockImplementation((data) => {
        const responseData = JSON.parse(data);
        
        // Validate response structure
        expect(responseData.status).toBe('success');
        expect(Array.isArray(responseData.data.programs)).toBe(true);
      });
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check response headers
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/json');
      expect(mockResponse.statusCode).toBe(200);
    });
    
    test('should handle /api/features GET requests', () => {
      // Create a mock features request
      const req = {
        method: 'GET',
        url: '/api/features'
      };
      
      // Mock the response end to capture JSON output
      mockResponse.end.mockImplementation((data) => {
        const responseData = JSON.parse(data);
        
        // Validate response structure
        expect(responseData.status).toBe('success');
        expect(responseData.data.features).toBeDefined();
        expect(typeof responseData.data.features.voiceCommands).toBe('boolean');
        expect(typeof responseData.data.features.darkMode).toBe('boolean');
      });
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check response status
      expect(mockResponse.statusCode).toBe(200);
    });
    
    test('should return 404 for unknown API endpoints', () => {
      // Create a mock request to an unknown endpoint
      const req = {
        method: 'GET',
        url: '/api/unknown-endpoint'
      };
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check response
      expect(mockResponse.statusCode).toBe(404);
      expect(mockResponse.end).toHaveBeenCalled();
    });
    
    test('should handle OPTIONS preflight requests', () => {
      // Create a mock OPTIONS request
      const req = {
        method: 'OPTIONS',
        url: '/api/chat'
      };
      
      // Call the request listener directly
      requestListener(req, mockResponse);
      
      // Check CORS headers
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      expect(mockResponse.statusCode).toBe(204);
    });
  });
});