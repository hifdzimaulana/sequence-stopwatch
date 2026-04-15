#!/bin/bash

echo "Stopping Sequence Stopwatch server on port 8080..."

# Find and kill the process using port 8080
PID=$(lsof -ti:8080)

if [ -z "$PID" ]; then
    echo "No server running on port 8080"
    exit 0
fi

kill $PID

# Wait a moment
sleep 1

# Verify server is stopped
if ! lsof -i :8080 > /dev/null 2>&1; then
    echo "Server stopped successfully!"
else
    # Force kill if still running
    kill -9 $PID 2>/dev/null
    echo "Server stopped (forced)"
fi