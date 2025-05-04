#!/usr/bin/env node

/**
 * This script generates a Swagger specification file from the JSDoc comments
 * in the API route files. The specification is saved to a JSON file that can
 * be served directly or used with other Swagger tools.
 */

const fs = require('fs');
const path = require('path');
const { swaggerSpec } = require('../server/config/swagger');

// Define output paths
const OUTPUT_DIR = path.join(__dirname, '../docs/api');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'swagger.json');

// Create directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write the Swagger spec to file
fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(swaggerSpec, null, 2)
);

console.log(`Swagger specification saved to ${OUTPUT_FILE}`);

// Generate a simple HTML page to render the Swagger UI
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StayCrest API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4/swagger-ui.css">
  <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@4/favicon-32x32.png" sizes="32x32" />
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .swagger-ui .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "./swagger.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        requestInterceptor: (req) => {
          if (req.url === "./swagger.json") {
            // This is for local development - forcing reload to avoid caching
            req.url = "./swagger.json?t=" + new Date().getTime();
          }
          return req;
        }
      });
    }
  </script>
</body>
</html>
`;

// Write the HTML file
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'index.html'),
  htmlContent
);

console.log(`Swagger UI HTML page saved to ${path.join(OUTPUT_DIR, 'index.html')}`);
console.log('You can view the documentation by opening this file in a browser'); 