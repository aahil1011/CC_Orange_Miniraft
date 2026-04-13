const WebSocket = require("ws");
const axios = require("axios");
const leaderTracker = require("./leaderTracker");
const { log } = require("./logger");

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server });
  const clients = new Set();

  function removeClient(socket) {
    if (clients.delete(socket)) {
      log(`Client disconnected, total: ${clients.size}`);
    }
  }

  function broadcastToAll(message) {
    const serializedMessage = JSON.stringify(message);

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(serializedMessage);
        } catch (error) {
          clients.delete(client);
        }
      }
    }
  }
/**
 * Forwards a stroke from a WebSocket client to the current RAFT leader.
 * Retries once automatically if the leader has changed (403 response).
 * Broadcasts the stroke to all clients on successful commit.
 * @param {object} stroke - Stroke data from the client
 * @param {boolean} hasRetried - Whether a retry has already been attempted
 */
  async function forwardStrokeToLeader(stroke, hasRetried = false) {
    if (!leaderTracker.isLeaderKnown()) {
      broadcastToAll({
        type: "error",
        message: "No leader available, try again"
      });
      return;
    }

    const leaderUrl = leaderTracker.getLeader();

    try {
      const response = await axios.post(
        `${leaderUrl}/stroke`,
        { stroke },
        {
          timeout: 1000,
          validateStatus: () => true
        }
      );

      if (response.status === 200) {
        log("Stroke forwarded to leader");
        broadcastToAll({
          type: "stroke",
          stroke
        });
        log("Stroke broadcast to all clients");
        return;
      }

      if (response.status === 403) {
        log("Leader changed, re-polling");
        await leaderTracker.poll();

        if (!hasRetried) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          await forwardStrokeToLeader(stroke, true);
          return;
        }

        broadcastToAll({
          type: "error",
          message: "Leader changed, please retry your stroke"
        });
        return;
      }

      log("Leader unreachable, re-polling");
      await leaderTracker.poll();
      broadcastToAll({
        type: "error",
        message: "Leader unavailable, try again"
      });
    } catch (error) {
      log("Leader unreachable, re-polling");
      await leaderTracker.poll();
      broadcastToAll({
        type: "error",
        message: "Leader unavailable, try again"
      });
    }
  }

  wss.on("connection", (socket) => {
    clients.add(socket);
    log(`Client connected, total: ${clients.size}`);

    socket.send(
      JSON.stringify({
        type: "connected",
        message: "Connected to drawing board"
      })
    );

    socket.send(
      JSON.stringify({
        type: "leader",
        leader: leaderTracker.getLeader(),
        term: leaderTracker.getLeaderTerm()
      })
    );

    socket.on("message", async (rawMessage) => {
      try {
        const data = JSON.parse(rawMessage.toString());

        if (data.type === "stroke") {
          log("Stroke received from client");
          await forwardStrokeToLeader(data.stroke);
        }

        if (data.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      } catch (error) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid message received"
          })
        );
      }
    });

    socket.on("close", () => {
      removeClient(socket);
    });

    socket.on("error", () => {
      removeClient(socket);
    });
  });

  return {
    broadcastToAll
  };
}

module.exports = setupWebSocket;
