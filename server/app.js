// server/app.js

const express = require('express');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const passport = require('passport');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const promClient = require('prom-client');
const { connectToRedis } = require('./database/redis-connection');
const RedisStore = require('connect-redis').default;

// Load environment variables
dotenv.config();

// Import routes
const legacyIndexRoutes = require('./routes/index');
const legacyAuthRoutes = require('./routes/auth');
const legacyUserRoutes = require('./routes/user');
const legacyAnalyticsRoutes = require('./routes/analytics');
const legacyAdminRoutes = require('./routes/admin');
const legacyHealthRoutes = require('./routes/health').router;

// Import versioned routes
const v1Routes = require('./routes/v1');

// Import WebSocket handler
const websocketHandler = require('./websocket/handler');

// Database connection
const connectDB = require('./database/connection');

// Import services
const authService = require('./services/auth-service').passport;
const memoryService = require('./services/memory-service');
const llmProvider = require('./services/llm-provider');
const webSearchService = require('./services/web-search-service');
const loyaltyWebsiteManager = require('./services/loyalty-website-manager');
const analyticsService = require('./services/analytics-service');
const ragService = require('./services/rag-service');
const workerThreadManager = require('./services/worker-thread-manager');
const searchSourcesService = require('./services/search-sources-service');

// Import agents and MCP
const ToolManager = require('./mcp/tool-manager');
const PlannerAgent = require('./agents/planner-agent');
const ExecutorAgent = require('./agents/executor-agent');
const SearchAgent = require('./agents/search-agent');
const MemorySystem = require('./agents/memory-system');

// Import middleware
const { versioningMiddleware } = require('./middleware/versioning');
const { errorHandler } = require('./middleware/error-handler');
const { metricsMiddleware } = require('./middleware/metrics-middleware');
const { securityHeaders } = require('./middleware/security-headers');
const { correlationIdMiddleware } = require('./middleware/correlation-id');

// Import OpenTelemetry for distributed tracing
const { setupTracing } = require('./config/tracing');

// Import Swagger setup
const { setupSwagger } = require('./config/swagger');

// Set up Prometheus client registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
  buckets: [1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
});
register.registerMetric(httpRequestDurationMicroseconds);

const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'code']
});
register.registerMetric(httpRequestCounter);

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'staycrest-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...metadata }) => {
          const metaString = Object.keys(metadata).length 
            ? JSON.stringify(metadata) 
            : '';
          return `${timestamp} ${level}: ${message} ${metaString}`;
        })
      )
    }),
    new winston.transports.File({ filename: 'logs/app.log' })
  ],
});

// Setup distributed tracing
setupTracing('staycrest-api');

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CLIENT_URL
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

// Connect to MongoDB
connectDB();

// Connect to Redis
const redisClient = connectToRedis();

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT) || 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later',
  keyGenerator: (req) => req.ip,
  skip: (req) => req.path.startsWith('/api/health'),
});

// Middleware
app.use(correlationIdMiddleware);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.CLIENT_URL, process.env.ADMIN_URL] 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-API-Version', 'X-Correlation-ID'],
  credentials: true,
  maxAge: 86400
}));

app.use(helmet(securityHeaders));
app.use(compression());

// Logging middleware with correlation ID
app.use((req, res, next) => {
  const startHrTime = process.hrtime();
  
  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1000000;
    
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${elapsedTimeInMs.toFixed(3)}ms`,
      correlationId: req.correlationId,
      ip: req.ip,
      userAgent: req.get('user-agent') || 'unknown'
    };
    
    if (req.user) {
      logData.userId = req.user.id;
    }
    
    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode}`, logData);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} ${res.statusCode}`, logData);
    }
    
    // Record metrics
    const route = req.route ? req.route.path : req.path;
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(elapsedTimeInMs);
    
    httpRequestCounter
      .labels(req.method, route, res.statusCode)
      .inc();
  });
  
  next();
});

app.use('/api/', apiLimiter);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Session configuration
const sessionMiddleware = session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'staycrest-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  }
});

app.use(sessionMiddleware);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Configure passport
require('./services/auth-service');

// WebSocket setup with session middleware
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Metrics middleware
app.use(metricsMiddleware);

websocketHandler(io);

// Initialize services and agents
const toolManager = new ToolManager();
let plannerAgent, executorAgent, searchAgent, memorySystemAgent;

const initializeServices = async () => {
  try {
    // Initialize worker thread manager first
    await workerThreadManager.initialize();
    logger.info('Worker thread manager initialized');
    
    // Initialize other services
    await analyticsService.initialize();
    logger.info('Analytics service initialized');
    
    // Initialize search sources service
    await searchSourcesService.initialize();
    logger.info('Search sources service initialized');
    
    await llmProvider.initialize();
    logger.info('LLM provider initialized');
    
    await webSearchService.initialize();
    logger.info('Web search service initialized');
    
    const loyaltyManager = new loyaltyWebsiteManager();
    await loyaltyManager.initialize();
    logger.info('Loyalty website manager initialized');
    
    await ragService.initialize();
    logger.info('RAG service initialized');

    // Initialize agent system
    memorySystemAgent = new MemorySystem();
    plannerAgent = new PlannerAgent(llmProvider, memorySystemAgent);
    executorAgent = new ExecutorAgent(llmProvider, toolManager);
    searchAgent = new SearchAgent(llmProvider, webSearchService);
    
    await plannerAgent.initialize();
    await executorAgent.initialize();
    await searchAgent.initialize();
    logger.info('Agent system initialized');
    
    // Register tools with the tool manager
    registerTools();
    logger.info('Tools registered');
    
    return true;
  } catch (error) {
    logger.error(`Error initializing services: ${error.message}`, { error });
    return false;
  }
};

// Register tools with the tool manager
const registerTools = () => {
  // Search tools
  toolManager.registerTool('search_web', async (params) => {
    return await webSearchService.search(params.query, params.options);
  }, {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      options: { type: 'object' }
    }
  });
  
  toolManager.registerTool('search_hotels', async (params) => {
    return await searchAgent.searchHotels(params.query, params.filters);
  }, {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      filters: { type: 'object' }
    }
  });
  
  // Memory tools
  toolManager.registerTool('store_memory', async (params) => {
    return await memorySystemAgent.store(params.memory);
  }, {
    type: 'object',
    required: ['memory'],
    properties: {
      memory: { type: 'object' }
    }
  });
  
  toolManager.registerTool('retrieve_memory', async (params) => {
    return await memorySystemAgent.retrieve(params.query, params.options);
  }, {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      options: { type: 'object' }
    }
  });
  
  // Planning tools
  toolManager.registerTool('create_plan', async (params) => {
    return await plannerAgent.createPlan(params.query, params.context);
  }, {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      context: { type: 'object' }
    }
  });
  
  toolManager.registerTool('optimize_loyalty', async (params) => {
    return await plannerAgent.optimizeLoyalty(params.preferences);
  }, {
    type: 'object',
    required: ['preferences'],
    properties: {
      preferences: { type: 'object' }
    }
  });
  
  // Execution tools
  toolManager.registerTool('execute_plan', async (params) => {
    return await executorAgent.execute(params.plan);
  }, {
    type: 'object',
    required: ['plan'],
    properties: {
      plan: { type: 'object' }
    }
  });
  
  // Hotel detail tools
  toolManager.registerTool('get_hotel_reviews', async (params) => {
    return await searchAgent.getReviews(params.hotelId);
  }, {
    type: 'object',
    required: ['hotelId'],
    properties: {
      hotelId: { type: 'string' }
    }
  });
  
  // RAG tools
  toolManager.registerTool('semantic_search', async (params) => {
    return await ragService.semanticSearch(params.query, params.options);
  }, {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      options: { type: 'object' }
    }
  });
  
  toolManager.registerTool('generate_rag_response', async (params) => {
    return await ragService.generateResponse(params.query, params.options);
  }, {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      options: { type: 'object' }
    }
  });
  
  // Worker thread tools
  toolManager.registerTool('generate_embedding', async (params) => {
    return await workerThreadManager.addTask('generateEmbedding', params);
  }, {
    type: 'object',
    required: ['text'],
    properties: {
      text: { type: 'string' },
      dimensions: { type: 'number' }
    }
  });
  
  toolManager.registerTool('process_image', async (params) => {
    return await workerThreadManager.addTask('processImage', params);
  }, {
    type: 'object',
    required: ['width', 'height'],
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      filters: { type: 'array' }
    }
  });
  
  toolManager.registerTool('score_search_results', async (params) => {
    return await workerThreadManager.addTask('scoreSearchResults', params);
  }, {
    type: 'object',
    required: ['query', 'documents'],
    properties: {
      query: { type: 'string' },
      documents: { type: 'array' },
      options: { type: 'object' }
    }
  });
  
  toolManager.registerTool('encrypt_data', async (params) => {
    return await workerThreadManager.addTask('encrypt', params);
  }, {
    type: 'object',
    required: ['text', 'key'],
    properties: {
      text: { type: 'string' },
      key: { type: 'string' },
      algorithm: { type: 'string' }
    }
  });
  
  toolManager.registerTool('decrypt_data', async (params) => {
    return await workerThreadManager.addTask('decrypt', params);
  }, {
    type: 'object',
    required: ['encrypted', 'key', 'iv'],
    properties: {
      encrypted: { type: 'string' },
      key: { type: 'string' },
      iv: { type: 'string' },
      algorithm: { type: 'string' }
    }
  });
  
  // Metadata tools
  toolManager.registerTool('get_service_status', async (params) => {
    return {
      llm: llmProvider.getStatus(),
      webSearch: webSearchService.getStatus(),
      workerThreads: workerThreadManager.getStats(),
      planner: plannerAgent.getStatus(),
      executor: executorAgent.getStatus(),
      search: searchAgent.getStatus(),
      memory: memorySystemAgent.getSize(),
      rag: await ragService.getStats(),
      tools: toolManager.getMetrics()
    };
  });
  
  // Compose higher-level tools from basic tools
  toolManager.composeTool('process_query', [
    {
      tool: 'create_plan',
      parameterMap: {
        query: 'params.query',
        context: 'params.context'
      }
    },
    {
      tool: 'execute_plan',
      parameterMap: {
        plan: 'result'
      }
    }
  ], {
    type: 'object',
    required: ['query'],
    properties: {
      query: { type: 'string' },
      context: { type: 'object' }
    }
  });
};

// Setup Swagger documentation
setupSwagger(app);

// API versioning middleware
app.use(versioningMiddleware);

// Versioned API routes
app.use('/api/v1', v1Routes);

// Legacy API routes (for backward compatibility)
app.use('/api', legacyIndexRoutes);
app.use('/api/auth', legacyAuthRoutes);
app.use('/api/user', legacyUserRoutes);
app.use('/api/analytics', legacyAnalyticsRoutes);
app.use('/api/admin', legacyAdminRoutes);
app.use('/api/health', legacyHealthRoutes);

// API version redirect for root path
app.get('/api', (req, res) => {
  res.json({
    name: 'StayCrest API',
    version: '1.0.0',
    description: 'StayCrest hotel discovery platform API',
    currentVersion: 'v1',
    documentation: '/api/docs',
    versions: {
      v1: {
        status: 'current',
        url: '/api/v1'
      }
    }
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  analyticsService.trackEvent('server_start', { port: PORT });
  
  // Initialize services after server starts
  initializeServices().then((success) => {
    if (success) {
      logger.info('All services initialized successfully');
    } else {
      logger.error('Failed to initialize all services');
    }
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, { error: err });
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { error: err });
  console.log('UNCAUGHT EXCEPTION! Shutting down...');
  console.log(err.name, err.message);
  
  process.exit(1);
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    redisClient.quit().then(() => {
      logger.info('Redis connection closed');
    });
    workerThreadManager.shutdown().then(() => {
      logger.info('Worker thread manager shut down');
    });
  });
});

module.exports = { app, server };