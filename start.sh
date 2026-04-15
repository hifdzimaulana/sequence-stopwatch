#!/bin/bash

echo "Starting Sequence Stopwatch server on port 8080..."

# Check if server is already running
if lsof -i :8080 > /dev/null 2>&1; then
    echo "Server is already running on port 8080"
    echo "URL: http://localhost:8080"
    exit 0
fi

# Start the server in background
python3 -m http.server 8080 > /dev/null 2>&1 &

# Wait a moment for server to start
sleep 1

# Verify server is running
if lsof -i :8080 > /dev/null 2>&1; then
    echo "Server started successfully!"
    echo "URL: http://localhost:8080"
else
    echo "Failed to start server"
    exit 1
fi