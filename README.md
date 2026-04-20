# Distributed Drawing Board

## What This Project Is

This project is a distributed drawing board backed by a three-node RAFT cluster. Browser clients connect to a WebSocket gateway, the gateway routes each stroke to the current RAFT leader, and the replicas replicate and commit those strokes so the board keeps working even when a leader fails and a new one is elected.

## Prerequisites

- Docker Desktop installed
- Node.js 18+ for local testing only
- Git

## How To Run Everything

1. Clone the repo.
2. Make the helper scripts executable:

   ```bash
   chmod +x scripts/start.sh scripts/logs.sh scripts/kill-leader.sh
   ```

3. Start the full stack:

   ```bash
   bash scripts/start.sh
   ```

   Or run Compose directly:

   ```bash
   docker-compose up --build
   ```

4. Open [http://localhost:8080](http://localhost:8080) in two browser tabs.
5. Draw on one tab and watch the stroke appear on the other tab through the gateway and RAFT replicas.

## How To Test Failover

1. Open [http://localhost:8080](http://localhost:8080) and draw something.
2. In a terminal run:

   ```bash
   bash scripts/kill-leader.sh
   ```

3. Keep drawing. The cluster should elect a new leader in under one second and continue accepting strokes.
4. Restart the killed node:

   ```bash
   docker-compose restart replica1
   ```

   Replace `replica1` with whichever replica was killed.

5. Watch it rejoin the cluster and catch up through `/sync-log`.

## Architecture Overview

- `replica1` runs the RAFT leader election engine and heartbeat management.
- `replica2` runs the RAFT log replication engine with AppendEntries, commit tracking, and catch-up sync.
- `replica3` is another full replica using the same code as `replica2`, with different environment variables.
- `gateway` polls replicas to discover the current leader and forwards browser strokes over HTTP while broadcasting updates over WebSocket.
- `frontend` serves the browser drawing board with Nginx on port `8080`, while the browser talks to the gateway on port `4000`.

## Team Members And Responsibilities

- Member 1: RAFT election engine (`replica1`)
- Member 2: Log replication (`replica2`)
- Member 3: Gateway + Frontend
- Member 4: Docker + DevOps

## Folder Structure

```text
.
|-- .env
|-- docker-compose.yml
|-- README.md
|-- frontend
|   |-- .dockerignore
|   |-- Dockerfile
|   |-- canvas.js
|   |-- index.html
|   |-- nginx.conf
|   |-- style.css
|   `-- ws.js
|-- gateway
|   |-- .env.example
|   |-- .dockerignore
|   |-- Dockerfile
|   |-- README.md
|   |-- index.js
|   |-- leaderTracker.js
|   |-- logger.js
|   |-- package.json
|   `-- wsHandler.js
|-- replica1
|   |-- .env.example
|   |-- .dockerignore
|   |-- Dockerfile
|   |-- README.md
|   |-- index.js
|   |-- logger.js
|   |-- package.json
|   |-- raftNode.js
|   |-- rpcClient.js
|   `-- rpcHandlers.js
|-- replica2
|   |-- .env.example
|   |-- .dockerignore
|   |-- Dockerfile
|   |-- README.md
|   |-- index.js
|   |-- logger.js
|   |-- logStore.js
|   |-- package-lock.json
|   |-- package.json
|   |-- raftNode.js
|   |-- rpcClient.js
|   `-- rpcHandlers.js
|-- replica3
|   |-- .env.example
|   |-- .dockerignore
|   |-- Dockerfile
|   |-- README.md
|   |-- index.js
|   |-- logger.js
|   |-- logStore.js
|   |-- package-lock.json
|   |-- package.json
|   |-- raftNode.js
|   |-- rpcClient.js
|   `-- rpcHandlers.js
`-- scripts
    |-- kill-leader.sh
    |-- logs.sh
    `-- start.sh
```
"# Distributed Drawing Board - RAFT Consensus" 
