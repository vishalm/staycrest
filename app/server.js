const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Simple configuration
const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.yaml': 'application/x-yaml',
};

// Simple in-memory database for demo purposes
const mockDB = {
  hotels: [
    {
      id: 'hotel-1',
      name: 'Grand Hyatt Hotel',
      chain: 'Hyatt',
      location: 'New York, NY',
      stars: 5,
      price: 350,
      currency: 'USD',
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8aG90ZWx8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60'
    },
    {
      id: 'hotel-2',
      name: 'Marriott Downtown',
      chain: 'Marriott',
      location: 'Chicago, IL',
      stars: 4,
      price: 280,
      currency: 'USD',
      image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8aG90ZWx8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60'
    },
    {
      id: 'hotel-3',
      name: 'Hilton Garden Inn',
      chain: 'Hilton',
      location: 'San Francisco, CA',
      stars: 4,
      price: 320,
      currency: 'USD',
      image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MzR8fGhvdGVsfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
    }
  ],
  loyaltyPrograms: [
    { id: 'loyalty-1', name: 'Marriott Bonvoy', pointsValue: 0.8, hotels: ['Marriott', 'Westin', 'Sheraton'] },
    { id: 'loyalty-2', name: 'Hilton Honors', pointsValue: 0.5, hotels: ['Hilton', 'DoubleTree', 'Embassy Suites'] },
    { id: 'loyalty-3', name: 'World of Hyatt', pointsValue: 1.2, hotels: ['Hyatt', 'Grand Hyatt', 'Park Hyatt'] }
  ]
};

// Track service start time for uptime calculation
const startTime = Date.now();

// Simple Swagger specification
const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'StayCrest API',
    version: '1.0.0',
    description: 'API documentation for the StayCrest hotel discovery platform',
    contact: {
      name: 'StayCrest Support',
      url: 'https://staycrest.example.com/support',
      email: 'support@staycrest.example.com'
    }
  },
  servers: [
    {
      url: '/api',
      description: 'Development server'
    }
  ],
  paths: {
    '/search': {
      get: {
        summary: 'Search for hotels',
        description: 'Find hotels based on search criteria',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Search query',
            schema: { type: 'string' }
          },
          {
            name: 'location',
            in: 'query',
            description: 'Filter by location',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        query: { type: 'string' },
                        hotels: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              chain: { type: 'string' },
                              location: { type: 'string' },
                              stars: { type: 'number' },
                              price: { type: 'number' },
                              currency: { type: 'string' },
                              image: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/chat': {
      post: {
        summary: 'Send chat message',
        description: 'Send a message to the AI assistant and receive a response',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  message: { type: 'string' },
                  sessionId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        response: { type: 'string' },
                        sessionId: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/loyalty/programs': {
      get: {
        summary: 'Get loyalty programs',
        description: 'Retrieve information about hotel loyalty programs',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        programs: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              pointsValue: { type: 'number' },
                              hotels: {
                                type: 'array',
                                items: { type: 'string' }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/features': {
      get: {
        summary: 'Get feature flags',
        description: 'Get configuration for enabled features',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'object',
                      properties: {
                        features: {
                          type: 'object',
                          properties: {
                            voiceCommands: { type: 'boolean' },
                            darkMode: { type: 'boolean' },
                            locationServices: { type: 'boolean' },
                            pointsCalculator: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Check if the API is running',
        responses: {
          '200': {
            description: 'API is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health/liveness': {
      get: {
        summary: 'Liveness probe',
        description: 'Kubernetes liveness probe endpoint',
        responses: {
          '200': {
            description: 'Service is alive',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/health/readiness': {
      get: {
        summary: 'Readiness probe',
        description: 'Kubernetes readiness probe endpoint',
        responses: {
          '200': {
            description: 'Service is ready',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    uptime: { type: 'number' },
                    ready: { type: 'boolean' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// Create HTTP Server
const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  // Normalize pathname to handle root url
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // API Routes
  if (pathname.startsWith('/api/')) {
    return handleApiRequest(req, res, pathname, parsedUrl);
  }
  
  // Serve static files
  serveStaticFile(res, pathname);
});

/**
 * Handle API requests
 */
function handleApiRequest(req, res, pathname, parsedUrl) {
  res.setHeader('Content-Type', 'application/json');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // Remove /api prefix for easier routing
  const apiPath = pathname.replace(/^\/api/, '');
  
  // API Endpoints
  switch(apiPath) {
    // Swagger API Documentation
    case '/docs':
    case '/docs/':
      serveSwaggerUI(res);
      break;
    
    // Swagger JSON spec
    case '/docs.json':
      res.statusCode = 200;
      res.end(JSON.stringify(swaggerSpec));
      break;
      
    // Get hotels by search criteria
    case '/search':
      if (req.method === 'GET') {
        // Read query parameters
        const query = parsedUrl.query.q || '';
        const location = parsedUrl.query.location || '';
        
        // Filter hotels (simple demo)
        let results = mockDB.hotels;
        if (query) {
          results = results.filter(hotel => 
            hotel.name.toLowerCase().includes(query.toLowerCase()) || 
            hotel.chain.toLowerCase().includes(query.toLowerCase()) ||
            hotel.location.toLowerCase().includes(query.toLowerCase())
          );
        }
        
        if (location) {
          results = results.filter(hotel => 
            hotel.location.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        // Send response (delayed to simulate network)
        setTimeout(() => {
          res.statusCode = 200;
          res.end(JSON.stringify({
            status: 'success',
            data: {
              query: query || location,
              hotels: results
            }
          }));
        }, 500);
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
      }
      break;
    
    // Chat API (simple echo for now)
    case '/chat':
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const message = data.message || '';
            const sessionId = data.sessionId || 'default';
            
            // Generate demo response
            let response;
            if (message.toLowerCase().includes('hotel')) {
              response = "I found several hotels that might interest you. Would you like to filter by location or price range?";
            } else if (message.toLowerCase().includes('loyalty') || message.toLowerCase().includes('points')) {
              response = "We support various loyalty programs including Marriott Bonvoy, Hilton Honors, and World of Hyatt. Would you like to compare their point values?";
            } else if (message.toLowerCase().includes('book') || message.toLowerCase().includes('reservation')) {
              response = "I can help you make a reservation. Could you provide your preferred dates and location?";
            } else {
              response = `I received your message: "${message}". How can I assist you with your travel plans today?`;
            }
            
            // Delayed response to simulate thinking
            setTimeout(() => {
              res.statusCode = 200;
              res.end(JSON.stringify({
                status: 'success',
                data: {
                  response,
                  sessionId
                }
              }));
            }, 1000);
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
          }
        });
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
      }
      break;
    
    // Get loyalty programs
    case '/loyalty/programs':
      if (req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'success',
          data: {
            programs: mockDB.loyaltyPrograms
          }
        }));
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
      }
      break;
    
    // Feature flags API - useful for enabling/disabling features
    case '/features':
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'success',
        data: {
          features: {
            voiceCommands: true,
            darkMode: true,
            locationServices: true,
            pointsCalculator: true
          }
        }
      }));
      break;

    // Health checks
    case '/health':
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      }));
      break;
      
    case '/health/liveness':
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString()
      }));
      break;
      
    case '/health/readiness':
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        ready: true,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        services: {
          mockDB: mockDB ? true : false
        }
      }));
      break;
      
    // Root API - show available endpoints
    case '':
    case '/':
      res.statusCode = 200;
      res.end(JSON.stringify({
        name: 'StayCrest API',
        version: '1.0.0',
        description: 'StayCrest hotel discovery platform API',
        documentation: '/api/docs',
        endpoints: [
          { path: '/api/search', method: 'GET', description: 'Search for hotels' },
          { path: '/api/chat', method: 'POST', description: 'Send a message to the AI assistant' },
          { path: '/api/loyalty/programs', method: 'GET', description: 'Get loyalty program information' },
          { path: '/api/features', method: 'GET', description: 'Get feature flags' },
          { path: '/api/health', method: 'GET', description: 'Health check' },
          { path: '/api/health/liveness', method: 'GET', description: 'Kubernetes liveness probe' },
          { path: '/api/health/readiness', method: 'GET', description: 'Kubernetes readiness probe' }
        ]
      }));
      break;
    
    // Default 404 for unknown API endpoints
    default:
      res.statusCode = 404;
      res.end(JSON.stringify({ status: 'error', message: 'API endpoint not found' }));
  }
}

/**
 * Serve Swagger UI
 */
function serveSwaggerUI(res) {
  // Serve a simple HTML file that loads Swagger UI from CDN
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="StayCrest API Documentation" />
      <title>StayCrest API Documentation</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui.css" />
      <style>
        body {
          margin: 0;
          background: #fafafa;
        }
        .topbar {
          display: none;
        }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@4.5.0/swagger-ui-bundle.js" crossorigin></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/api/docs.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout",
            persistAuthorization: true,
          });
        };
      </script>
    </body>
    </html>
  `;
  res.statusCode = 200;
  res.end(html);
}

/**
 * Serve static files
 */
function serveStaticFile(res, pathname) {
  // Determine the file path
  const filePath = path.join(__dirname, pathname);
  const fileExt = path.extname(filePath);
  
  // Read file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // If file not found
      if (err.code === 'ENOENT') {
        // Try index.html for SPA fallback
        if (pathname !== '/index.html') {
          return serveStaticFile(res, '/index.html');
        }
        
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404 Not Found');
        return;
      }
      
      // Other server error
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('500 Internal Server Error');
      return;
    }
    
    // Set proper content type
    const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // Ensure HTML files have correct content-type, 
    // even if MIME_TYPES don't have the correct mapping
    if (fileExt === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (fileExt === '.css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (fileExt === '.js') {
      // If JavaScript module, set proper MIME type
      if (data.includes('export') || data.includes('import')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      } else {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      }
    } else if (fileExt === '.json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    
    // Add cache control headers to improve performance
    if (fileExt === '.html') {
      // Don't cache HTML - always get fresh content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // Cache other assets for 1 day
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    
    // Return file content
    res.statusCode = 200;
    res.end(data);
  });
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`API available at http://localhost:${PORT}/api/`);
  console.log(`API documentation available at http://localhost:${PORT}/api/docs`);
  console.log(`Health check available at http://localhost:${PORT}/api/health`);
}); 