#!/bin/bash

# Finds current leader by polling /status on all replicas.
# Then kills that container to simulate leader failure.
# Used for demo: shows automatic failover.

for port in 3001 3002 3003; do
  STATE=$(curl -s http://localhost:$port/status | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
  if [ "$STATE" = "leader" ]; then
    echo "Found leader on port $port, killing it..."
    if [ $port -eq 3001 ]; then docker kill replica1; fi
    if [ $port -eq 3002 ]; then docker kill replica2; fi
    if [ $port -eq 3003 ]; then docker kill replica3; fi
    echo "Leader killed. Watch the other replicas elect a new leader."
    exit 0
  fi
done

echo "No leader found currently."
