/**
 * Header Check Tool for StayCrest
 * 
 * A special diagnostic script to troubleshoot issues with Content-Type headers.
 * This creates a lightweight server that logs detailed request/response information.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Create a dedicated server on port 3002 that won't conflict with the main server
const PORT = 3002;

// Log file for easier diagnosis
const LOG_FILE = 'header-diagnostic.log';

// Start with a fresh log file
fs.writeFileSync(LOG_FILE, `StayCrest Header Diagnostic Tool - ${new Date().toISOString()}\n\n`);

// Log both to console and file
function log(message) {
  console.log(message);
  fs.appendFileSync(LOG_FILE, message + '\n');
}

log('Starting StayCrest Header Diagnostic Tool...');
log(`Using port ${PORT} to avoid conflict with main server`);
log('==========================================');

// Create server
const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname === '/' ? '/index.html' : parsedUrl.pathname;
  
  // Log request details
  log(`\n[${timestamp}] Request: ${req.method} ${req.url}`);
  log(`User-Agent: ${req.headers['user-agent']}`);
  log(`Accept: ${req.headers['accept']}`);
  
  // Determine the file path
  const filePath = path.join(__dirname, pathname);
  log(`File Path: ${filePath}`);
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      log(`File Not Found: ${filePath}`);
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('404 Not Found');
      log(`Response: 404 Not Found`);
      return;
    }
    
    // File exists, determine content type
    const fileExt = path.extname(filePath);
    let contentType = 'text/plain';
    
    switch (fileExt) {
      case '.html':
        contentType = 'text/html; charset=utf-8';
        break;
      case '.css':
        contentType = 'text/css; charset=utf-8';
        break;
      case '.js':
        contentType = 'text/javascript; charset=utf-8';
        break;
      case '.json':
        contentType = 'application/json; charset=utf-8';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.ico':
        contentType = 'image/x-icon';
        break;
    }
    
    log(`Content-Type: ${contentType}`);
    
    // Read and serve the file
    fs.readFile(filePath, (err, data) => {
      if (err) {
        log(`Error Reading File: ${err.message}`);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.end('500 Internal Server Error');
        log(`Response: 500 Internal Server Error`);
        return;
      }
      
      // Special check for JS files with ES modules
      if (fileExt === '.js' && data.includes('export') || data.includes('import')) {
        contentType = 'application/javascript; charset=utf-8';
        log(`Detected ES Module, updated Content-Type: ${contentType}`);
      }
      
      // Set headers
      res.setHeader('Content-Type', contentType);
      // Force no-cache for diagnostic purposes
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Add CORS headers for diagnostics
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Log response headers
      log('Response Headers:');
      Object.keys(res._headers).forEach(header => {
        log(`  ${header}: ${res._headers[header]}`);
      });
      
      // Check response size
      log(`Response Size: ${data.length} bytes`);
      
      // Serve the file
      res.statusCode = 200;
      res.end(data);
      log(`Response: 200 OK`);
    });
  });
});

// Start the server
server.listen(PORT, () => {
  log(`Diagnostic server is running at http://localhost:${PORT}/`);
  log(`Visit this URL in your browser to test Content-Type headers`);
  log(`Check ${LOG_FILE} for detailed logs`);
}); 