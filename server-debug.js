const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('.'));

// Log requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Special handler for ES module files to ensure correct MIME type
app.get('*.js', (req, res, next) => {
  const filePath = path.join(__dirname, req.url);
  
  // Check if file exists
  if (fs.existsSync(filePath)) {
    // If path ends with .js and is a module (imported or exported), set correct MIME type
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('import') || content.includes('export')) {
      res.set('Content-Type', 'application/javascript; charset=UTF-8');
    }
  }
  next();
});

// Handle 404s for debugging
app.use((req, res) => {
  console.log(`[404] ${req.url}`);
  res.status(404).send(`File not found: ${req.url}`);
});

// Start server
app.listen(PORT, () => {
  console.log(`Debug server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT}/index.html in your browser`);
}); 