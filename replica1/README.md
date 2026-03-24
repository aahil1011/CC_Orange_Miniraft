# Replica 1 RAFT Engine

This service implements Member 1's portion of the distributed drawing board RAFT layer: leader election and heartbeat management.

## Install

```bash
cd replica1
npm install
```

## Run Standalone

### PowerShell

```powershell
$env:REPLICA_ID="replica1"
$env:REPLICA_PORT="3001"
$env:PEERS="http://replica2:3002,http://replica3:3003"
npm start
```

### Bash

```bash
REPLICA_ID=replica1 REPLICA_PORT=3001 PEERS=http://replica2:3002,http://replica3:3003 npm start
```

## File Overview

- `index.js` boots the Express server, loads environment variables, and mounts the RPC routes.
- `raftNode.js` stores the in-memory RAFT state machine, election timer, heartbeat timer, and transition logic.
- `rpcHandlers.js` exposes HTTP endpoints for vote requests, heartbeats, and replica status.
- `rpcClient.js` sends outbound vote and heartbeat RPCs to peers with timeouts and fault-tolerant broadcasts.
- `logger.js` prints timestamped RAFT-aware log lines with replica ID, term, and node state.
- `package.json` defines dependencies and start/dev scripts.
- `.env.example` shows the required runtime environment variables.
- `README.md` documents setup, usage, and test commands.

## Test With curl

### Check node status

```bash
curl http://localhost:3001/status
```

### Simulate a vote request

```bash
curl -X POST http://localhost:3001/request-vote \
  -H "Content-Type: application/json" \
  -d '{"term":1,"candidateId":"replica2"}'
```

### Simulate a heartbeat

```bash
curl -X POST http://localhost:3001/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"term":1,"leaderId":"replica2"}'
```

## Example Log Output

```text
[2024-01-01T10:00:00.000Z][replica1][TERM:1][candidate] Election started for term 1
[2024-01-01T10:00:00.120Z][replica1][TERM:1][leader] State transition to leader for term 1
[2024-01-01T10:00:00.270Z][replica1][TERM:1][leader] Heartbeat sent to http://replica2:3002
[2024-01-01T10:00:00.320Z][replica1][TERM:1][follower] Heartbeat received from replica2
```
