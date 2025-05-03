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
  
  // API Endpoints
  switch(pathname) {
    // Get hotels by search criteria
    case '/api/search':
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
    case '/api/chat':
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
    case '/api/loyalty/programs':
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
    case '/api/features':
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
    
    // Default 404 for unknown API endpoints
    default:
      res.statusCode = 404;
      res.end(JSON.stringify({ status: 'error', message: 'API endpoint not found' }));
  }
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
    
    // If JavaScript module, set proper MIME type
    if (fileExt === '.js' && data.includes('export') || data.includes('import')) {
      res.setHeader('Content-Type', 'application/javascript');
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
}); 