# Gateway And Frontend

This gateway sits between browsers and the three RAFT replicas. Browsers connect only to the gateway over WebSocket, the gateway polls replicas to discover the current leader, and accepted strokes are forwarded to the leader before being broadcast back out to every connected browser.

## Install

```bash
cd gateway
npm install
```

## Run Standalone

### PowerShell

```powershell
$env:GATEWAY_PORT="4000"
$env:REPLICAS="http://replica1:3001,http://replica2:3002,http://replica3:3003"
npm start
```

### Bash

```bash
GATEWAY_PORT=4000 REPLICAS=http://replica1:3001,http://replica2:3002,http://replica3:3003 npm start
```

Then open [http://localhost:4000](http://localhost:4000) to use the browser drawing board.

## Files

- `index.js` starts the HTTP server, serves the frontend, exposes `/health`, and boots WebSocket plus leader polling.
- `leaderTracker.js` polls replica `/status` endpoints every second and tracks the current leader URL and term.
- `wsHandler.js` accepts browser WebSocket clients, forwards strokes to the current leader, and broadcasts accepted strokes.
- `logger.js` prints gateway-scoped logs with timestamps.

## Health Check

```bash
curl http://localhost:4000/health
```

Example response:

```json
{
  "status": "ok",
  "leader": "http://replica2:3002",
  "term": 4
}
```

## WebSocket Message Flow

Client to gateway:

```json
{
  "type": "stroke",
  "stroke": {
    "id": "browser-1-42",
    "x1": 0.12,
    "y1": 0.18,
    "x2": 0.21,
    "y2": 0.32,
    "color": "#ff6b35",
    "width": 4
  }
}
```

Gateway to clients:

```json
{
  "type": "stroke",
  "stroke": {
    "id": "browser-1-42",
    "x1": 0.12,
    "y1": 0.18,
    "x2": 0.21,
    "y2": 0.32,
    "color": "#ff6b35",
    "width": 4
  }
}
```

## How Leader Routing Works

1. `leaderTracker.js` polls each replica's `/status` endpoint every second.
2. When it finds `state === "leader"`, it stores that replica URL as the current target for browser strokes.
3. Each browser stroke arrives over WebSocket and is posted to `POST /stroke` on the known leader.
4. If the leader rejects the request with `403`, the gateway re-polls and retries once after 300ms.
5. On success, the gateway broadcasts the stroke to every connected browser so all canvases stay in sync.
