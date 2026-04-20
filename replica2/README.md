# Replica 2 RAFT Log Replication

This service is a full replica node that includes Member 1's leader election and heartbeat behavior, then adds Member 2's responsibilities on top: stroke log management, AppendEntries replication, commit tracking, and follower catch-up sync.

## Install

```bash
cd replica2
npm install
```

## Run Standalone

### PowerShell

```powershell
$env:REPLICA_ID="replica2"
$env:REPLICA_PORT="3002"
$env:PEERS="http://replica1:3001,http://replica3:3003"
npm start
```

### Bash

```bash
REPLICA_ID=replica2 REPLICA_PORT=3002 PEERS=http://replica1:3001,http://replica3:3003 npm start
```

## What Member 2 Adds

- `logStore.js` keeps the in-memory append-only stroke log and commit index.
- `raftNode.js` tracks log replication metadata (`nextIndex`, `matchIndex`, `ackCounts`) and commits entries once a majority acknowledges them.
- `rpcClient.js` adds outbound `/append-entries` replication and `/sync-log` catch-up requests.
- `rpcHandlers.js` adds `/append-entries`, `/stroke`, and `/sync-log` routes alongside the base RAFT endpoints.

## curl Tests

### Replicate a single log entry

```bash
curl -X POST http://localhost:3002/append-entries \
  -H "Content-Type: application/json" \
  -d '{"term":2,"leaderId":"replica1","entry":{"index":0,"term":2,"stroke":{"x1":10,"y1":20,"x2":40,"y2":60,"color":"#111"}},"prevLogIndex":-1,"prevLogTerm":0}'
```

### Submit a stroke through the leader API

```bash
curl -X POST http://localhost:3002/stroke \
  -H "Content-Type: application/json" \
  -d '{"stroke":{"x1":5,"y1":5,"x2":25,"y2":25,"color":"#ff6600","width":3}}'
```

### Request catch-up log entries

```bash
curl -X POST http://localhost:3002/sync-log \
  -H "Content-Type: application/json" \
  -d '{"fromIndex":0}'
```

### Check replica state

```bash
curl http://localhost:3002/status
```

## Example Committed Entry

```json
{
  "index": 3,
  "term": 4,
  "stroke": {
    "x1": 12,
    "y1": 18,
    "x2": 88,
    "y2": 54,
    "color": "#0066ff",
    "width": 2
  }
}
```

## Catch-up Sync Flow

1. A follower restarts with a shorter log or misses AppendEntries while the leader continues accepting strokes.
2. The leader keeps sending heartbeats, so the follower learns `leaderId` and resets its election timer.
3. The follower requests `/sync-log` from the known leader starting at `logStore.getLength()`.
4. The leader returns every missing entry from that index onward.
5. The follower applies only entries it does not already have, so replaying the same sync twice is safe.
6. The follower advances its local commit index for the synced range and logs the applied catch-up entries.
