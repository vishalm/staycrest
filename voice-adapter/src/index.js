const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createLogger, format, transports } = require('winston');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configure Winston logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: '/app/logs/voice-adapter.log' })
  ]
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/app/uploads');
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

const app = express();
const port = process.env.PORT || 3200;

app.use(cors());
app.use(express.json());

// Create upload and cache directories
const uploadsDir = path.join(__dirname, '../uploads');
const cacheDir = path.join(__dirname, '../cache');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(cacheDir, { recursive: true });

// WebSocket server for streaming
const wss = new WebSocket.Server({ noServer: true });

// Voice service configuration
const VOICE_SERVICE_URL = process.env.VOICE_SERVICE_URL || 'http://voice-service:80';
const ENABLE_STREAMING = process.env.ENABLE_STREAMING === 'true';

// Handle WebSocket connections
wss.on('connection', (ws) => {
  logger.info('New WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      logger.debug('Received WebSocket message', { data });

      // Handle different message types
      switch (data.type) {
        case 'start_stream':
          // Initialize streaming session
          break;
        case 'audio_data':
          // Process audio data
          break;
        case 'stop_stream':
          // End streaming session
          break;
        default:
          logger.warn('Unknown message type', { type: data.type });
      }
    } catch (error) {
      logger.error('Error processing WebSocket message', { error });
      ws.send(JSON.stringify({ error: 'Failed to process message' }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check if voice service is accessible
    const response = await fetch(`${VOICE_SERVICE_URL}/health`);
    if (!response.ok) {
      return res.status(503).json({ 
        status: 'unhealthy',
        error: 'Voice service is not available'
      });
    }
    res.json({ status: 'healthy' });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({ 
      status: 'unhealthy',
      error: 'Voice service is not accessible'
    });
  }
});

// Text-to-speech endpoint
app.post('/tts', async (req, res) => {
  try {
    const { text, voice_id = 'default', language = 'en' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    logger.info('Processing TTS request', { text, voice_id, language });

    // Prepare request payload according to Coqui TTS API
    const payload = {
      text,
      voice_id,
      language,
      format: 'wav',
      speed: 1.0
    };

    logger.debug('Sending request to voice service', { 
      url: `${VOICE_SERVICE_URL}/api/v1/tts`,
      payload 
    });

    const response = await fetch(`${VOICE_SERVICE_URL}/api/v1/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Voice service error', { 
        status: response.status, 
        error: errorText 
      });
      throw new Error(`Voice service error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.buffer();
    
    // Cache the audio file
    const cacheFile = path.join(cacheDir, `${uuidv4()}.wav`);
    fs.writeFileSync(cacheFile, audioBuffer);
    logger.debug('Cached audio file', { path: cacheFile });

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=31536000'
    });
    res.send(audioBuffer);
  } catch (error) {
    logger.error('TTS request failed', { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ 
      error: 'Failed to process TTS request',
      details: error.message
    });
  }
});

// Speech-to-text endpoint
app.post('/stt', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    logger.info('Processing STT request', { filename: req.file.filename });

    const formData = new FormData();
    formData.append('audio', fs.createReadStream(req.file.path));

    const response = await fetch(`${VOICE_SERVICE_URL}/api/v1/stt`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Voice service error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    res.json(result);

    // Cleanup uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error('Failed to delete uploaded file', { error: err });
    });
  } catch (error) {
    logger.error('STT request failed', { error });
    res.status(500).json({ 
      error: 'Failed to process STT request',
      details: error.message
    });
  }
});

// Start the server
const server = app.listen(port, () => {
  logger.info(`Voice adapter service listening on port ${port}`);
});

// Upgrade HTTP server to handle WebSocket connections
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
}); 