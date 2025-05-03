# StayCrest 🏨✨

## Simple AI-Powered Hotel Discovery Platform

StayCrest is a demonstration platform for hotel discovery with AI-powered conversations and a beautiful UI with dark/light mode.

## Features

- 🎨 **Beautiful UI with Dark/Light Mode**: Toggle between themes with smooth transitions
- 🤖 **AI Chat Interface**: Converse naturally to find hotels and information
- 🔍 **Hotel Search**: Search and view hotel details
- 🗣️ **Voice Input Simulation**: Voice interface for hotel queries
- 🌐 **Simple Backend API**: No complex dependencies required

## Quick Start

### 1. Start the Server

```bash
# Start the server with node
node server.js

# Or use the convenience script
./start.sh
```

### 2. Access the Application

Open your browser and navigate to:
- **Web Application**: http://localhost:3000

### 3. Try It Out

- Toggle dark/light mode with the sun/moon button
- Ask for hotels in various locations
- Try the voice input feature
- View hotel search results

## API Endpoints

- **GET /api/search**: Search for hotels
- **POST /api/chat**: Send chat messages
- **GET /api/loyalty/programs**: Get loyalty program information
- **GET /api/features**: Get feature flags

## Development

### Prerequisites

- Node.js (v18 or higher)

### Running in Development Mode

To run with automatic restarts on code changes:

```bash
# Install nodemon if you don't have it
npm install -g nodemon

# Run with nodemon
npm run dev
```

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js (no framework dependencies)
- **Data Storage**: In-memory mock database

## License

MIT License

## Acknowledgments

StayCrest is a demonstration project showing how to build a modern web application with minimal dependencies while maintaining excellent UI/UX.

---

Made with ❤️ for travelers by travelers
