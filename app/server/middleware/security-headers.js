/**
 * Security Headers Middleware
 * 
 * This module defines security headers for the application using Helmet configuration.
 * It includes CSP, HSTS, and other security headers to enhance the application security.
 */

// CSP configuration based on environment
const getCspConfig = () => {
  // Base CSP directives for both development and production
  const baseDirectives = {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "https://*.staycrest.example.com", "https://secure.gravatar.com"],
    scriptSrc: ["'self'"],
    connectSrc: ["'self'", "https://*.staycrest.example.com"],
    frameAncestors: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  };
  
  // Additional directives for development environment
  if (process.env.NODE_ENV !== 'production') {
    // Allow inline scripts for Swagger UI in development
    baseDirectives.scriptSrc.push("'unsafe-inline'", "'unsafe-eval'");
    
    // Allow connect to localhost for development API calls
    baseDirectives.connectSrc.push("http://localhost:*", "ws://localhost:*");
    
    // Remove upgrade-insecure-requests in development
    delete baseDirectives.upgradeInsecureRequests;
  }
  
  return baseDirectives;
};

// Configure security headers
const securityHeaders = {
  // Content Security Policy
  contentSecurityPolicy: {
    directives: getCspConfig()
  },
  
  // HTTP Strict Transport Security
  // Only enable in production
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: {
    action: 'deny'
  },
  
  // X-Content-Type-Options
  contentTypeOptions: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer-Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  
  // Permissions Policy
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  
  // Don't expose that we're using Express
  hidePoweredBy: true,
  
  // Disable DNS prefetching
  dnsPrefetchControl: {
    allow: false
  },
  
  // Don't allow browser to detect MIME type
  noSniff: true
};

// Export security configuration
module.exports = { securityHeaders }; 