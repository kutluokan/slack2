#!/bin/bash

# Function to handle process termination
cleanup() {
    echo "Received SIGTERM/SIGINT"
    kill -TERM "$UPLOAD_PID" 2>/dev/null
    kill -TERM "$MAIN_PID" 2>/dev/null
    exit 0
}

# Function to check if a service is ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local retries=30
    local wait_time=1

    echo "Waiting for $service_name to be ready..."
    while ! curl -s "http://localhost:$port/health" > /dev/null; do
        retries=$((retries - 1))
        if [ $retries -eq 0 ]; then
            echo "$service_name failed to start"
            return 1
        fi
        echo "Waiting for $service_name... ($retries attempts left)"
        sleep $wait_time
    done
    echo "$service_name is ready!"
    return 0
}

# Set up signal handling
trap cleanup SIGTERM SIGINT

# Start the upload service
echo "Starting upload service..."
python -m uvicorn upload:app --host 0.0.0.0 --port 8000 &
UPLOAD_PID=$!

# Wait for upload service to be ready
wait_for_service 8000 "upload service" || exit 1

# Start the main service
echo "Starting main service..."
python -m uvicorn main:app --host 0.0.0.0 --port 8001 &
MAIN_PID=$!

# Wait for main service to be ready
wait_for_service 8001 "main service" || exit 1

echo "All services are running!"

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $? 