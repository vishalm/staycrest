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
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Text-to-speech endpoint
app.post('/tts', async (req, res) => {
  try {
    const { text, voice_id } = req.body;
    logger.info('Processing TTS request', { text, voice_id });

    const response = await fetch(`${VOICE_SERVICE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id })
    });

    if (!response.ok) {
      throw new Error(`Voice service responded with ${response.status}`);
    }

    const audioBuffer = await response.buffer();
    res.set('Content-Type', 'audio/wav');
    res.send(audioBuffer);
  } catch (error) {
    logger.error('TTS request failed', { error });
    res.status(500).json({ error: 'Failed to process TTS request' });
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

    const response = await fetch(`${VOICE_SERVICE_URL}/api/stt`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Voice service responded with ${response.status}`);
    }

    const result = await response.json();
    res.json(result);

    // Cleanup uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) logger.error('Failed to delete uploaded file', { error: err });
    });
  } catch (error) {
    logger.error('STT request failed', { error });
    res.status(500).json({ error: 'Failed to process STT request' });
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