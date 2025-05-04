/**
 * API Versioning Middleware
 * 
 * This middleware routes requests to the appropriate API version handlers.
 * It supports:
 * - URL path versioning (e.g., /api/v1/resource)
 * - Header versioning (Accept-Version or X-API-Version headers)
 * - Query parameter versioning (e.g., ?version=1)
 * 
 * Priority order:
 * 1. URL path
 * 2. Header
 * 3. Query parameter
 * 4. Default to latest version
 */

const logger = require('../services/logging-service').getLogger('versioning');

const SUPPORTED_VERSIONS = ['1']; // List of supported API versions
const DEFAULT_VERSION = '1';     // Default version to use if not specified

/**
 * Extract API version from request
 * @param {Object} req - Express request object
 * @returns {string} - API version (without the 'v' prefix)
 */
const extractVersion = (req) => {
  let version;
  
  // Check URL path - /api/v1/resource
  if (req.path.match(/^\/v(\d+)($|\/)/)) {
    version = req.path.match(/^\/v(\d+)($|\/)/)[1];
    logger.debug('Version extracted from URL path', { version, path: req.path });
  }
  
  // Check headers - Accept-Version or X-API-Version
  if (!version && (req.headers['accept-version'] || req.headers['x-api-version'])) {
    version = (req.headers['accept-version'] || req.headers['x-api-version']).replace(/v/i, '');
    logger.debug('Version extracted from header', { version, header: req.headers['accept-version'] || req.headers['x-api-version'] });
  }
  
  // Check query parameter - ?version=1
  if (!version && req.query.version) {
    version = req.query.version.replace(/v/i, '');
    logger.debug('Version extracted from query parameter', { version, query: req.query.version });
  }
  
  // Use default version if not specified or invalid
  if (!version || !SUPPORTED_VERSIONS.includes(version)) {
    if (version) {
      logger.warn('Unsupported API version requested, using default', { 
        requestedVersion: version, 
        defaultVersion: DEFAULT_VERSION,
        supportedVersions: SUPPORTED_VERSIONS
      });
    }
    version = DEFAULT_VERSION;
  }
  
  return version;
};

/**
 * Middleware to handle API versioning
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const versioningMiddleware = (req, res, next) => {
  // Skip versioning for non-API routes and some specific endpoints
  if (!req.path.startsWith('/api') || 
      req.path.startsWith('/api/docs') || 
      req.path.startsWith('/api/health')) {
    return next();
  }
  
  const version = extractVersion(req);
  
  // Store the version in the request object for later use
  req.apiVersion = version;
  
  // Rewrite the URL to include the version if it's not already there
  if (!req.path.match(/^\/v\d+($|\/)/)) {
    // Remove /api prefix if present
    const path = req.path.replace(/^\/api/, '');
    
    // Set versioned path in req object for route handlers to use
    req.versionedPath = `/v${version}${path}`;
    logger.debug('Rewritten path for versioning', { 
      originalPath: req.path, 
      versionedPath: req.versionedPath,
      version
    });
  } else {
    // Path already contains version
    req.versionedPath = req.path;
  }
  
  next();
};

/**
 * Create router for version-specific routes
 * @param {Object} routeMap - Map of version numbers to route handlers
 * @returns {Function} - Express middleware
 */
const versionRouter = (routeMap) => {
  return (req, res, next) => {
    const version = req.apiVersion || DEFAULT_VERSION;
    
    // Check if we have routes for this version
    if (routeMap[version]) {
      return routeMap[version](req, res, next);
    }
    
    // If version not found in map, try the default version
    if (version !== DEFAULT_VERSION && routeMap[DEFAULT_VERSION]) {
      logger.warn('Using default version routes', { requestedVersion: version, defaultVersion: DEFAULT_VERSION });
      return routeMap[DEFAULT_VERSION](req, res, next);
    }
    
    // If no handler found, continue to next middleware
    next();
  };
};

module.exports = {
  versioningMiddleware,
  versionRouter,
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION
}; 