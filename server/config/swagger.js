const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const packageInfo = require('../../package.json');

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'StayCrest API Documentation',
      version: packageInfo.version || '1.0.0',
      description: 'API documentation for the StayCrest hotel discovery platform',
      contact: {
        name: 'StayCrest Support',
        url: 'https://staycrest.example.com/support',
        email: 'support@staycrest.example.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://staycrest.example.com/terms'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.staycrest.example.com/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: [
    './server/routes/v1/*.js',
    './server/models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Configure Swagger middleware for Express
 * @param {Express.Application} app - Express application instance
 */
const setupSwagger = (app) => {
  // Serve Swagger documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }'
  }));

  // Serve Swagger spec as JSON
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('Swagger documentation is available at /api/docs');
};

module.exports = { setupSwagger, swaggerSpec }; 