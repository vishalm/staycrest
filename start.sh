#!/bin/bash

# Print banner
echo "=========================================="
echo "   Starting StayCrest Server              "
echo "   http://localhost:3000                  "
echo "=========================================="

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js to run this server."
    exit 1
fi

# Check if port 3000 is already in use
PORT_IN_USE=false
if command -v lsof &> /dev/null; then
    PORT_USAGE=$(lsof -i :3000 -sTCP:LISTEN)
    if [ ! -z "$PORT_USAGE" ]; then
        echo "Warning: Port 3000 is already in use:"
        echo "$PORT_USAGE"
        echo ""
        echo "Options:"
        echo "1. Kill the existing process and try again"
        echo "2. Continue anyway (might not work)"
        echo "3. Exit"
        read -p "Choose option (1-3): " choice
        
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
            *)
                echo "Exiting."
                exit 0
                ;;
        esac
    fi
fi

# Run the server with additional checks
echo "Starting server..."

# If port was in use and user chose to continue anyway, use different server options
if [ "$PORT_IN_USE" = true ]; then
    # Try to run server in debug mode on a different port
    PORT=3001 node server-debug.js
else
    # Run normally
    node server.js || {
        echo ""
        echo "Server failed to start. Trying debug mode..."
        node server-debug.js
    }
fi

# Exit message
echo ""
echo "Server stopped." 