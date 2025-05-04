#!/bin/bash

# Debug Script for StayCrest Server

echo "=========================================="
echo "   StayCrest Server Diagnostics          "
echo "=========================================="

# Check Node.js installation
echo -e "\n📌 Checking Node.js installation..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Node.js is installed: $NODE_VERSION"
else
    echo "❌ Node.js is not installed or not in PATH"
    echo "   Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if required files exist
echo -e "\n📌 Checking required files..."

# Main files
FILES_TO_CHECK=(
    "index.html"
    "server.js"
    "js/app-simple.js"
    "css/main.css"
    "css/fixes.css"
    "assets/images/StayCrest_LOGO.png"
)

MISSING_FILES=0
for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        MISSING_FILES=$((MISSING_FILES+1))
    fi
done

if [ $MISSING_FILES -gt 0 ]; then
    echo -e "\n⚠️ $MISSING_FILES file(s) are missing. This may cause the application to not load properly."
else
    echo -e "\n✅ All required files are present."
fi

# Check if port 3000 is already in use
echo -e "\n📌 Checking if port 3000 is already in use..."
if command -v lsof &> /dev/null; then
    PORT_USAGE=$(lsof -i :3000 -sTCP:LISTEN)
    if [ -z "$PORT_USAGE" ]; then
        echo "✅ Port 3000 is available"
    else
        echo "⚠️ Port 3000 is already in use by:"
        echo "$PORT_USAGE"
        echo "   You might need to kill this process before starting the server."
    fi
else
    echo "ℹ️ Cannot check port usage (lsof command not available)"
fi

# Start server in debug mode
echo -e "\n📌 Attempting to start server in debug mode..."
echo "   Server will run with verbose logging for 5 seconds..."

# Run the server with NODE_DEBUG for 5 seconds
NODE_DEBUG=http,net,stream node server.js &
SERVER_PID=$!

# Wait for 5 seconds
sleep 5

# Kill the server
kill $SERVER_PID 2>/dev/null

echo -e "\n📌 Server check complete"
echo "   If you see any errors above, address them before starting the server."
echo "   If everything looks good, run ./start.sh to start the server."
echo "=========================================="

# Suggest next steps
echo -e "\n📋 Troubleshooting steps if page isn't loading:"
echo "1. Make sure all required files exist (check above)"
echo "2. Try accessing http://localhost:3000 directly in your browser"
echo "3. Check browser console for JavaScript errors"
echo "4. Verify that CSS paths in index.html match your file structure"
echo "5. If getting 404 errors, check file paths in server.js"
echo "6. Try running: node server-debug.js (if available)"
echo "==========================================" 