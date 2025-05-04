#!/bin/bash

# Print banner
echo "=========================================="
echo "   Starting StayCrest Server              "
echo "   http://localhost:3000                  "
echo "=========================================="

# Check for dependencies
echo "Checking dependencies..."

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js to run this server."
    exit 1
fi

# Check node version
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d '.' -f 1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Warning: Node.js version $NODE_VERSION detected. StayCrest requires Node.js 18 or higher."
    echo "Some features may not work correctly. Consider upgrading your Node.js installation."
    echo ""
fi

# Check for required NPM packages
if [ ! -d "node_modules" ]; then
    echo "Node modules not found. Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies. Please run 'npm install' manually."
        exit 1
    fi
    echo "Dependencies installed successfully."
fi

# Check if port 3000 is already in use
PORT_IN_USE=false
if command -v lsof &> /dev/null; then
    PORT_USAGE=$(lsof -i :3000 -sTCP:LISTEN 2>/dev/null)
    if [ ! -z "$PORT_USAGE" ]; then
        echo "Warning: Port 3000 is already in use:"
        echo "$PORT_USAGE"
        echo ""
        echo "Options:"
        echo "1. Kill the existing process and try again"
        echo "2. Continue anyway (might not work)"
        echo "3. Start on a different port"
        echo "4. Exit"
        read -p "Choose option (1-4): " choice
        
        case $choice in
            1)
                PID=$(echo "$PORT_USAGE" | awk 'NR>1 {print $2}' | head -n 1)
                if [ ! -z "$PID" ]; then
                    echo "Attempting to kill process $PID..."
                    kill $PID
                    sleep 2
                    if kill -0 $PID 2>/dev/null; then
                        echo "Process is still running. Try manual termination or choose another option."
                        exit 1
                    else
                        echo "Process successfully terminated."
                    fi
                else
                    echo "Could not determine process ID. Try manual termination."
                    exit 1
                fi
                ;;
            2)
                echo "Continuing anyway..."
                PORT_IN_USE=true
                ;;
            3)
                read -p "Enter alternate port number: " ALT_PORT
                echo "Starting on port $ALT_PORT..."
                PORT=$ALT_PORT
                ;;
            *)
                echo "Exiting."
                exit 0
                ;;
        esac
    fi
else
    echo "Warning: 'lsof' command not available. Cannot check if port is in use."
fi

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    mkdir -p logs
    echo "Created logs directory."
fi

# Run the server with additional checks
echo "Starting server..."

# Set default port if not specified
PORT=${PORT:-3000}

# If port was in use and user chose to continue anyway, use different options
if [ "$PORT_IN_USE" = true ]; then
    # Try to run server in debug mode
    NODE_ENV=development DEBUG=express:* node server/app.js
else
    # Run the full Express application
    node server/app.js || {
        echo ""
        echo "Server failed to start. Trying debug mode..."
        NODE_ENV=development DEBUG=express:* node server/app.js || {
            echo ""
            echo "Debug mode failed. Trying simple server as fallback..."
            node server.js
        }
    }
fi

# Exit message
echo ""
echo "Server stopped." 