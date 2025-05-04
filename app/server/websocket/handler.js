// server/websocket/handler.js

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/user');
const SearchHistory = require('../models/search-history');
const memoryService = require('../services/memory-service');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/websocket.log' })
  ],
});

/**
 * WebSocket handler
 * @param {Object} io - Socket.io instance
 */
const websocketHandler = (io) => {
  // Track connected clients
  const connectedClients = new Map();
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow connection without authentication, but mark as guest
        socket.data.authenticated = false;
        socket.data.sessionId = uuidv4();
        return next();
      }
      
      // Verify JWT token
      const decoded = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'your_jwt_secret_key_here'
      );
      
      // Get user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      // Attach user to socket
      socket.data.authenticated = true;
      socket.data.user = {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
      };
      
      // Generate or reuse session ID
      socket.data.sessionId = socket.handshake.auth.sessionId || uuidv4();
      
      return next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        // Allow connection without authentication, but mark as guest
        socket.data.authenticated = false;
        socket.data.sessionId = uuidv4();
        return next();
      }
      
      logger.error(`WebSocket authentication error: ${error.message}`);
      return next(new Error('Authentication error'));
    }
  });
  
  // Handle connection
  io.on('connection', (socket) => {
    // Add client to connected clients map
    connectedClients.set(socket.id, {
      id: socket.id,
      userId: socket.data.authenticated ? socket.data.user.id : null,
      sessionId: socket.data.sessionId,
      connected: true,
      connectedAt: new Date(),
    });
    
    logger.info(`Client connected: ${socket.id}${socket.data.authenticated ? ' (authenticated)' : ' (guest)'}`);
    
    // Send session info to client
    socket.emit('session', {
      sessionId: socket.data.sessionId,
      authenticated: socket.data.authenticated,
      user: socket.data.user || null,
    });
    
    // Handle chat messages
    socket.on('chat_message', async (data) => {
      try {
        const { message, metadata } = data;
        
        if (!message || !message.trim()) {
          return socket.emit('error', { message: 'Message cannot be empty' });
        }
        
        // Create message object
        const messageObj = {
          role: 'user',
          content: message,
          timestamp: new Date(),
          metadata: metadata || {},
        };
        
        // Store message in memory service
        const userId = socket.data.authenticated ? socket.data.user.id : 'guest';
        const conversation = await memoryService.storeMessage(
          userId,
          socket.data.sessionId,
          messageObj
        );
        
        // Acknowledge receipt
        socket.emit('message_received', {
          messageId: conversation.messages[conversation.messages.length - 1]._id,
          timestamp: new Date(),
        });
        
        // TODO: Process message with agent system
        // For now, just echo back
        
        // Create assistant response
        const responseMessage = {
          role: 'assistant',
          content: `Echo: ${message}`,
          timestamp: new Date(),
          metadata: { echo: true },
        };
        
        // Store assistant response
        await memoryService.storeMessage(
          userId,
          socket.data.sessionId,
          responseMessage
        );
        
        // Send response to client
        socket.emit('chat_message', responseMessage);
      } catch (error) {
        logger.error(`Error processing chat message: ${error.message}`);
        socket.emit('error', { message: 'Error processing your message' });
      }
    });
    
    // Handle voice transcriptions
    socket.on('voice_transcript', async (data) => {
      try {
        const { transcript, final, metadata } = data;
        
        if (!transcript || !transcript.trim()) {
          return;
        }
        
        // Forward interim transcripts without processing
        if (!final) {
          return socket.emit('transcript_update', { transcript, final: false });
        }
        
        // Process final transcript as a chat message
        const messageObj = {
          role: 'user',
          content: transcript,
          timestamp: new Date(),
          metadata: { ...metadata, source: 'voice' },
        };
        
        // Store message in memory service
        const userId = socket.data.authenticated ? socket.data.user.id : 'guest';
        const conversation = await memoryService.storeMessage(
          userId,
          socket.data.sessionId,
          messageObj
        );
        
        // Acknowledge receipt
        socket.emit('message_received', {
          messageId: conversation.messages[conversation.messages.length - 1]._id,
          timestamp: new Date(),
        });
        
        // TODO: Process message with agent system
        // For now, just echo back
        
        // Create assistant response
        const responseMessage = {
          role: 'assistant',
          content: `Echo (voice): ${transcript}`,
          timestamp: new Date(),
          metadata: { echo: true, voice: true },
        };
        
        // Store assistant response
        await memoryService.storeMessage(
          userId,
          socket.data.sessionId,
          responseMessage
        );
        
        // Send response to client
        socket.emit('chat_message', responseMessage);
      } catch (error) {
        logger.error(`Error processing voice transcript: ${error.message}`);
        socket.emit('error', { message: 'Error processing your voice input' });
      }
    });
    
    // Handle search queries
    socket.on('search_query', async (data) => {
      try {
        const { query, parameters, loyaltyPrograms } = data;
        
        if (!query || !query.trim()) {
          return socket.emit('error', { message: 'Search query cannot be empty' });
        }
        
        // Create search record
        const userId = socket.data.authenticated ? socket.data.user.id : 'guest';
        
        // Only store searches for authenticated users
        if (socket.data.authenticated) {
          const searchHistory = await SearchHistory.create({
            userId,
            query,
            parameters: parameters || {},
            loyaltyPrograms: loyaltyPrograms || [],
            createdAt: new Date(),
          });
          
          // Link search to conversation
          await memoryService.linkSearchToConversation(
            userId,
            socket.data.sessionId,
            searchHistory._id
          );
          
          // Acknowledge search
          socket.emit('search_acknowledged', {
            searchId: searchHistory._id,
            timestamp: new Date(),
          });
        }
        
        // TODO: Process search with agent system
        // For now, just return dummy results
        
        const dummyResults = {
          query,
          timestamp: new Date(),
          count: 3,
          hotels: [
            {
              id: 'hotel1',
              name: 'Luxury Hotel A',
              chain: 'Marriott',
              price: 250,
              currency: 'USD',
              stars: 5,
              location: 'City Center',
              image: 'https://example.com/hotelA.jpg',
            },
            {
              id: 'hotel2',
              name: 'Luxury Hotel B',
              chain: 'Hilton',
              price: 220,
              currency: 'USD',
              stars: 4,
              location: 'Downtown',
              image: 'https://example.com/hotelB.jpg',
            },
            {
              id: 'hotel3',
              name: 'Luxury Hotel C',
              chain: 'Hyatt',
              price: 280,
              currency: 'USD',
              stars: 5,
              location: 'Beachfront',
              image: 'https://example.com/hotelC.jpg',
            },
          ],
        };
        
        // Send results to client
        socket.emit('search_results', dummyResults);
      } catch (error) {
        logger.error(`Error processing search query: ${error.message}`);
        socket.emit('error', { message: 'Error processing your search' });
      }
    });
    
    // Handle configuration saves
    socket.on('configuration_save', async (data) => {
      try {
        // Only for authenticated users
        if (!socket.data.authenticated) {
          return socket.emit('error', { message: 'Authentication required' });
        }
        
        // TODO: Implement configuration saving
        
        // Acknowledge
        socket.emit('configuration_saved', {
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error(`Error saving configuration: ${error.message}`);
        socket.emit('error', { message: 'Error saving configuration' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing', (data) => {
      const { isTyping } = data;
      
      // Broadcast typing status to all clients in the same room (if using rooms)
      // For now, just acknowledge
      socket.emit('typing_acknowledged', { isTyping });
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      // Update client status
      const client = connectedClients.get(socket.id);
      if (client) {
        client.connected = false;
        client.disconnectedAt = new Date();
        connectedClients.set(socket.id, client);
      }
      
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
  
  // Return handler for testing
  return {
    io,
    getConnectedClients: () => connectedClients,
  };
};

module.exports = websocketHandler;