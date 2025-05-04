#!/bin/bash

# Print banner
echo "=========================================="
echo "   Stopping StayCrest Server              "
echo "=========================================="

# Check if lsof is available
if ! command -v lsof &> /dev/null; then
    echo "Error: 'lsof' command not found. Cannot check for processes using ports."
    echo "You may need to manually terminate any running Node.js processes."
    echo "Try: 'pkill -f node' or 'killall node' to stop all Node.js processes."
    exit 1
fi

# Ports to check (default is 3000, also check 3001 which might be used as fallback)
PORTS_TO_CHECK=(3000 3001)
FOUND_PROCESSES=false

for PORT in "${PORTS_TO_CHECK[@]}"; do
    echo "Checking port $PORT..."
    PORT_USAGE=$(lsof -i :$PORT -sTCP:LISTEN 2>/dev/null)
    
    if [ ! -z "$PORT_USAGE" ]; then
        FOUND_PROCESSES=true
        echo "Port $PORT is in use by:"
        echo "$PORT_USAGE"
        echo ""
        
        # Get the PIDs
        PIDS=$(echo "$PORT_USAGE" | awk 'NR>1 {print $2}')
        
        if [ ! -z "$PIDS" ]; then
            echo "Attempting to stop the processes..."
            for PID in $PIDS; do
                echo "Stopping process $PID..."
                kill $PID
                sleep 1
                if kill -0 $PID 2>/dev/null; then
                    echo "Process $PID is still running. Trying force kill..."
                    kill -9 $PID
                    sleep 1
                    if kill -0 $PID 2>/dev/null; then
                        echo "Failed to kill process $PID. Please terminate it manually."
                    else
                        echo "Process $PID successfully terminated."
                    fi
                else
                    echo "Process $PID successfully terminated."
                fi
            done
        else
            echo "Could not determine process IDs. Try manual termination."
        fi
    fi
done

# Check if no processes were found on specified ports
if [ "$FOUND_PROCESSES" = false ]; then
    echo "No StayCrest processes found on ports ${PORTS_TO_CHECK[*]}"
    
    # Check if any node processes might be related to StayCrest
    NODE_PROCESSES=$(ps aux | grep -E 'node.*((server\.js)|(app\.js))' | grep -v grep)
    
    if [ ! -z "$NODE_PROCESSES" ]; then
        echo ""
        echo "Found potentially relevant Node.js processes:"
        echo "$NODE_PROCESSES"
        echo ""
        read -p "Do you want to attempt to terminate these processes? (y/n): " choice
        
        if [[ $choice =~ ^[Yy]$ ]]; then
            echo "Terminating Node.js processes..."
            NODE_PIDS=$(echo "$NODE_PROCESSES" | awk '{print $2}')
            
            for PID in $NODE_PIDS; do
                echo "Stopping process $PID..."
                kill $PID
                sleep 1
                if kill -0 $PID 2>/dev/null; then
                    echo "Process $PID is still running. Trying force kill..."
                    kill -9 $PID
                else
                    echo "Process $PID successfully terminated."
                fi
            done
        else
            echo "No action taken on these processes."
        fi
    fi
fi

echo ""
echo "Done. You can now start the server again." 