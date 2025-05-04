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

// Load environment variables
dotenv.config();

// Import routes
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health').router;

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

// Import agents and MCP
const ToolManager = require('./mcp/tool-manager');
const PlannerAgent = require('./agents/planner-agent');
const ExecutorAgent = require('./agents/executor-agent');
const SearchAgent = require('./agents/search-agent');
const MemorySystem = require('./agents/memory-system');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ],
});

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

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/api/', apiLimiter);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'staycrest-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Configure passport
require('./services/auth-service');

// WebSocket setup
websocketHandler(io);

// Initialize services and agents
const toolManager = new ToolManager();
let plannerAgent, executorAgent, searchAgent, memorySystemAgent;

const initializeServices = async () => {
  try {
    // Initialize services
    await analyticsService.initialize();
    logger.info('Analytics service initialized');
    
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
    logger.error(`Error initializing services: ${error.message}`);
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
  
  // Metadata tools
  toolManager.registerTool('get_service_status', async (params) => {
    return {
      llm: llmProvider.getStatus(),
      webSearch: webSearchService.getStatus(),
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

// API routes
app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  analyticsService.trackError(err, { path: req.path, method: req.method });
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  analyticsService.trackEvent('server_start', { port: PORT });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  console.log('UNHANDLED REJECTION! Shutting down...');
  console.log(err.name, err.message);
  
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

module.exports = { app, server };