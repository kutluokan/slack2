#!/bin/bash

# Start the main app on port 8000
uvicorn main:app --host 0.0.0.0 --port 8000 &

# Start the upload app on port 8001
uvicorn upload:app --host 0.0.0.0 --port 8001 &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
