const express = require('express');
const router = express.Router();

// Import all v1 routes
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const userRoutes = require('./user');
// Import other versioned routes as needed
// const analyticsRoutes = require('./analytics');
// const adminRoutes = require('./admin');

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *             status:
 *               type: integer
 *       example:
 *         error:
 *           message: Unauthorized
 *           status: 401
 *   responses:
 *     UnauthorizedError:
 *       description: Authentication credentials are required or invalid
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error:
 *               message: Please authenticate
 *               status: 401
 *     ForbiddenError:
 *       description: User does not have permission to access the resource
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error:
 *               message: Not authorized to access this resource
 *               status: 403
 *     NotFoundError:
 *       description: The requested resource was not found
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error:
 *               message: Resource not found
 *               status: 404
 *     ValidationError:
 *       description: Validation error occurred
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "error"
 *               message:
 *                 type: string
 *                 example: "Validation error"
 *               errors:
 *                 type: object
 *           example:
 *             status: "error"
 *             message: "Validation error"
 *             errors:
 *               email: "Please enter a valid email address"
 *     ServerError:
 *       description: Internal server error
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Error'
 *           example:
 *             error:
 *               message: Internal Server Error
 *               status: 500
 */

// Link all routes to their respective endpoints
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
// router.use('/analytics', analyticsRoutes);
// router.use('/admin', adminRoutes);

// Version-specific features or documentation
router.get('/', (req, res) => {
  res.json({
    apiVersion: '1',
    description: 'StayCrest API v1',
    documentation: '/api/docs',
    endpoints: [
      '/health',
      '/auth',
      '/user',
      // Add other available endpoints
    ]
  });
});

module.exports = router; 