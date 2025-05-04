# StayCrest 🏨✨

## AI-Powered Hotel Discovery Platform

StayCrest is a demonstration platform for hotel discovery with AI-powered conversations, a beautiful UI with dark/light mode, and a simple but powerful backend.

## Features

- 🎨 **Beautiful UI with Dark/Light Mode**: Toggle between themes with smooth transitions
- 🤖 **AI Chat Interface**: Converse naturally to find hotels and information
- 🔍 **Hotel Search**: Search and view hotel details with rich information
- 🗣️ **Voice Input Simulation**: Voice interface for hotel queries
- 🌐 **Simple Backend API**: No complex dependencies required
- 🧪 **Comprehensive Test Suite**: Full test coverage with Jest

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
  - Query params: `q` (search term), `location` (optional filter)
  - Returns hotel listings matching the search criteria

- **POST /api/chat**: Send chat messages
  - Body: `{ "message": "your message", "sessionId": "unique-session-id" }`
  - Returns AI-generated responses based on the input

- **GET /api/loyalty/programs**: Get loyalty program information
  - Returns data about hotel loyalty programs, point values, and affiliated hotel chains

- **GET /api/features**: Get feature flags
  - Returns configuration for enabled features like voice commands and dark mode

## Prompts Collection Architecture

### User Interaction Prompts

These prompts help guide users through the StayCrest experience:

#### Search Prompts

```json
{
  "initial": "What destination are you interested in?",
  "refinement": "Would you like to filter by {criteria}?",
  "dateSelection": "When are you planning to stay?",
  "guestCount": "How many guests will be staying?"
}
```

#### Loyalty Prompts

```json
{
  "programComparison": "Would you like to compare point values between {program1} and {program2}?",
  "pointsEstimation": "Based on your stay, you could earn approximately {points} points.",
  "redemptionOptions": "With {points} points, you could stay at these properties:"
}
```

#### Conversation Starters

```json
{
  "welcome": "Welcome to StayCrest! How can I help with your hotel search today?",
  "suggestions": [
    "Find hotels in Paris for next weekend",
    "Compare Marriott Bonvoy and Hilton Honors points",
    "Show luxury hotels in New York under $400/night",
    "What's the best value for my points in Chicago?"
  ]
}
```

### AI Response Templates

```json
{
  "hotelFound": "I found {count} hotels in {location} matching your criteria.",
  "noResults": "I couldn't find hotels matching {criteria}. Would you like to try different search parameters?",
  "loyaltyComparison": "For a typical stay, {program1} offers {value1} cents per point while {program2} offers {value2} cents per point.",
  "dateConfirmation": "I've set your travel dates to check-in on {checkIn} and check-out on {checkOut}. Is this correct?"
}
```

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

## Testing

StayCrest includes a comprehensive test suite using Jest:

```bash
# Run all tests with coverage report
npm test

# Run tests in watch mode during development
npm run test:watch

# Run only client-side tests
npm run test:client

# Run only server-side tests
npm run test:server
```

### Test Coverage

The test suite covers:
- Theme toggle functionality
- Modal interactions
- Chat with backend integration
- Voice recognition simulation
- Hotel search and results display
- Backend API endpoints

## Project Structure

```
staycrest/
├── assets/             # Images, fonts, and other static assets
├── css/                # Stylesheets
│   ├── main.css        # Main styles
│   └── fixes.css       # CSS fixes for critical functionality
├── js/                 # JavaScript files
│   ├── app.js          # Main application code (ES modules)
│   └── app-simple.js   # Simplified application (no modules)
├── server/             # Server-side code
├── tests/              # Test files
│   ├── client/         # Client-side tests
│   └── server/         # Server-side tests
├── index.html          # Main HTML file
├── server.js           # Simple Node.js server
└── package.json        # Project dependencies
```

## Technologies Used

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: Node.js (no framework dependencies)
- **Data Storage**: In-memory mock database
- **Testing**: Jest with JSDOM

## License

MIT License

## Acknowledgments

StayCrest is a demonstration project showing how to build a modern web application with minimal dependencies while maintaining excellent UI/UX.

---

Made with ❤️ for travelers by travelers
