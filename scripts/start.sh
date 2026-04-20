#!/bin/bash

echo "Building and starting the distributed drawing board..."
docker-compose down
docker-compose build
docker-compose up -d
echo ""
echo "System is running!"
echo "  Frontend:  http://localhost:8080"
echo "  Gateway:   http://localhost:4000"
echo "  Replica1:  http://localhost:3001/status"
echo "  Replica2:  http://localhost:3002/status"
echo "  Replica3:  http://localhost:3003/status"
echo ""
echo "Run 'bash scripts/logs.sh' to watch live logs"
echo "Run 'bash scripts/kill-leader.sh' to simulate leader failure"
