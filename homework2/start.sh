#!/bin/sh

# Start script to run both backend and frontend in the same container

echo "Starting CodeView application..."

# Start the backend in the background
echo "Starting backend on port 3001..."
cd /app/backend && node dist/index.js &
BACKEND_PID=$!

# Give the backend a moment to start
sleep 2

# Start the frontend
echo "Starting frontend on port 3000..."
cd /app/frontend && node build/index.js &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "CodeView is running!"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend API: http://localhost:3001"
echo ""

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
