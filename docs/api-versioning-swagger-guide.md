# StayCrest API Versioning and Documentation Guide

## Overview

This document provides instructions for using and extending the API versioning and Swagger documentation in the StayCrest application. The API now includes:

1. **API Versioning** - All APIs now use versioning through the `/api/v1/` path prefix, headers, or query parameters
2. **Swagger Documentation** - Interactive API documentation available at `/api/docs`
3. **Backward Compatibility** - Legacy unversioned endpoints are still supported

## API Versioning

### How It Works

StayCrest uses a flexible versioning approach that supports:

1. **URL Path Versioning** - `/api/v1/health` (recommended)
2. **Header Versioning** - Using `Accept-Version: v1` or `X-API-Version: v1` headers
3. **Query Parameter Versioning** - `/api/health?version=1`

The versioning middleware prioritizes these methods in the order listed above. If no version is specified, the default version (currently `v1`) is used.

### Adding a New API Version

To add a new API version (e.g., v2):

1. Create a new directory structure:
   ```
   server/routes/v2/
   ```

2. Update the supported versions in the versioning middleware (`server/middleware/versioning.js`):
   ```js
   const SUPPORTED_VERSIONS = ['1', '2']; // Add new version
   ```

3. Create versioned route files in the new directory
4. Update the Swagger configuration in `server/config/swagger.js` to include the new version:
   ```js
   servers: [
     {
       url: '/api/v1',
       description: 'Version 1'
     },
     {
       url: '/api/v2',
       description: 'Version 2 (New)'
     }
   ]
   ```

5. Create a route index file (`server/routes/v2/index.js`) and register it in `app.js`:
   ```js
   const v2Routes = require('./routes/v2');
   app.use('/api/v2', v2Routes);
   ```

## Swagger Documentation

### Accessing Documentation

The Swagger UI is available at:
- Development: `http://localhost:3000/api/docs`
- Production: `https://api.staycrest.example.com/api/docs`

The raw OpenAPI specification is available at `/api/docs.json`.

### Adding Documentation to API Endpoints

Add JSDoc-style comments to your route files:

```js
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get system health status
 *     description: Returns basic information about system health
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 */
router.get('/', async (req, res) => {
  // Route implementation
});
```

### Documentation Structure

1. Use `tags` to group related endpoints
2. Define response schemas with appropriate examples
3. Document authentication requirements using `security`
4. Add detailed descriptions for complex parameters

### Common Schema Definitions

Common schemas (like Error responses) are defined in `server/routes/v1/index.js` and can be referenced in your route documentation.

Example of referencing common schemas:

```js
/**
 * @swagger
 * /some/route:
 *   get:
 *     responses:
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
```

## Authentication in Swagger

Protected endpoints use JWT Bearer authentication. The Swagger UI allows you to:

1. Click the "Authorize" button
2. Enter your JWT token
3. Test protected endpoints directly in the UI

## Best Practices

1. Always add Swagger documentation to new endpoints
2. Keep documentation synchronized with code changes
3. Use descriptive summaries and detailed descriptions
4. Include example responses for complex endpoints
5. Always specify the proper response codes
6. Test documentation by using the Swagger UI

## Troubleshooting

### Invalid Swagger Schema

If your documentation doesn't appear correctly:

1. Check for syntax errors in your JSDoc comments
2. Verify that the route file is included in the `apis` array in `server/config/swagger.js`
3. Restart the server to rebuild the Swagger specs

### Authentication Issues

If you're unable to authenticate in Swagger UI:

1. Ensure your token is valid and not expired
2. Include the 'Bearer ' prefix if required
3. Check that CORS and CSP settings aren't blocking the Swagger UI

## Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger JSDoc Documentation](https://github.com/Surnet/swagger-jsdoc/blob/master/docs/GETTING-STARTED.md)
- [Express Router Documentation](https://expressjs.com/en/guide/routing.html) 