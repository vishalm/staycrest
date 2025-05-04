/**
 * StayCrest Server - Debug Version
 * Enhanced logging for troubleshooting file serving issues
 */

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

console.log('🔍 Starting StayCrest server in DEBUG mode');
console.log('📂 Current directory:', __dirname);
console.log('📋 Checking for critical files:');

// Check for critical files
const criticalFiles = [
  'index.html',
  'js/app-simple.js',
  'css/main.css',
  'css/fixes.css'
];

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} - ${stats.size} bytes`);
  } catch (err) {
    console.error(`❌ ${file} - NOT FOUND`);
  }
});

// Import mockDB from server.js
const mockDB = require('./server.js').mockDB || {
  hotels: [
    {
      id: 'hotel-1',
      name: 'Test Hotel',
      location: 'Test Location',
      price: 100,
      currency: 'USD'
    }
  ],
  loyaltyPrograms: [
    { id: 'loyalty-1', name: 'Test Program', pointsValue: 1.0 }
  ]
};

// Create HTTP Server with enhanced logging
const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  
  console.log(`🔗 Parsed path: ${pathname}`);
  
  // Normalize pathname to handle root url
  if (pathname === '/') {
    pathname = '/index.html';
    console.log(`🔀 Redirecting to index.html`);
  }
  
  // API Routes
  if (pathname.startsWith('/api/')) {
    console.log(`🔌 Handling API request: ${pathname}`);
    return handleApiRequest(req, res, pathname, parsedUrl);
  }
  
  // Serve static files with enhanced logging
  console.log(`📄 Serving static file: ${pathname}`);
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
        
        console.log(`🔍 Search query: "${query}", location: "${location}"`);
        
        // Filter hotels (simple demo)
        let results = mockDB.hotels;
        if (query) {
          results = results.filter(hotel => 
            hotel.name.toLowerCase().includes(query.toLowerCase()) || 
            hotel.location.toLowerCase().includes(query.toLowerCase())
          );
        }
        
        if (location) {
          results = results.filter(hotel => 
            hotel.location.toLowerCase().includes(location.toLowerCase())
          );
        }
        
        console.log(`📊 Found ${results.length} hotels matching criteria`);
        
        // Send response
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'success',
          data: {
            query: query || location,
            hotels: results
          }
        }));
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
      }
      break;
    
    // Chat API (simple echo for demo)
    case '/api/chat':
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
          console.log(`📨 Received chat data chunk: ${chunk.length} bytes`);
        });
        
        req.on('end', () => {
          try {
            console.log(`📨 Full chat request body: ${body}`);
            const data = JSON.parse(body);
            const message = data.message || '';
            const sessionId = data.sessionId || 'default';
            
            console.log(`💬 Chat message: "${message}" (Session: ${sessionId})`);
            
            // Generate demo response
            let response = `I received your message: "${message}". How can I assist you with your travel plans today?`;
            
            // Send response
            res.statusCode = 200;
            res.end(JSON.stringify({
              status: 'success',
              data: {
                response,
                sessionId
              }
            }));
          } catch (error) {
            console.error(`❌ Error processing chat request: ${error.message}`);
            res.statusCode = 400;
            res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
          }
        });
      } else {
        res.statusCode = 405;
        res.end(JSON.stringify({ status: 'error', message: 'Method not allowed' }));
      }
      break;
    
    // Features API - useful for enabling/disabling features
    case '/api/features':
      console.log(`⚙️ Serving feature flags`);
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
      console.log(`❌ Unknown API endpoint: ${pathname}`);
      res.statusCode = 404;
      res.end(JSON.stringify({ status: 'error', message: 'API endpoint not found' }));
  }
}

/**
 * Serve static files with enhanced logging
 */
function serveStaticFile(res, pathname) {
  // Determine the file path
  const filePath = path.join(__dirname, pathname);
  const fileExt = path.extname(filePath);
  
  console.log(`📂 Attempting to serve: ${filePath}`);
  
  // Read file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // If file not found
      if (err.code === 'ENOENT') {
        console.error(`❌ File not found: ${filePath}`);
        
        // Try index.html for SPA fallback
        if (pathname !== '/index.html') {
          console.log(`🔄 Falling back to index.html`);
          return serveStaticFile(res, '/index.html');
        }
        
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('404 Not Found');
        return;
      }
      
      // Other server error
      console.error(`❌ Server error reading file: ${err.message}`);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('500 Internal Server Error');
      return;
    }
    
    // Set proper content type
    const contentType = MIME_TYPES[fileExt] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    
    // Debug logging for content type
    console.log(`🔤 Content-Type from MIME map: ${contentType}`);
    
    // Ensure HTML files have correct content-type, even if MIME_TYPES don't have the correct mapping
    if (fileExt === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      console.log(`🔄 Overriding Content-Type to: text/html; charset=utf-8`);
    } else if (fileExt === '.css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      console.log(`🔄 Overriding Content-Type to: text/css; charset=utf-8`);
    } else if (fileExt === '.js') {
      // If JavaScript module, set proper MIME type
      if (data.includes('export') || data.includes('import')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        console.log(`🔄 Overriding Content-Type to: application/javascript; charset=utf-8 (ES module)`);
      } else {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        console.log(`🔄 Overriding Content-Type to: text/javascript; charset=utf-8`);
      }
    } else if (fileExt === '.json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      console.log(`🔄 Overriding Content-Type to: application/json; charset=utf-8`);
    }
    
    // Add cache control headers to improve performance
    if (fileExt === '.html') {
      // Don't cache HTML - always get fresh content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // Cache other assets for 1 day
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
    
    console.log(`✅ Serving file (${data.length} bytes) with final Content-Type: ${res.getHeader('Content-Type')}`);
    
    // Return file content
    res.statusCode = 200;
    res.end(data);
  });
}

// Start the server
server.listen(PORT, () => {
  console.log(`\n🚀 Debug Server running at http://localhost:${PORT}/`);
  console.log(`🔌 API available at http://localhost:${PORT}/api/`);
  console.log(`\n💡 Open your browser and navigate to http://localhost:${PORT}/`);
  console.log(`📝 Debug logs will appear below...\n`);
}); 