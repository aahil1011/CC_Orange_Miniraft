(function setupGatewaySocket() {
  const connectionStatus = document.getElementById("connectionStatus");
  const leaderValue = document.getElementById("leaderValue");
  const termValue = document.getElementById("termValue");
  const activityValue = document.getElementById("activityValue");

  const state = {
    socket: null,
    reconnectHandle: null,
    healthHandle: null,
    pingHandle: null
  };

  function getHttpBaseUrl() {
    if (window.location.protocol === "file:") {
      return "http://localhost:4000";
    }

    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  function getWsUrl() {
    if (window.location.protocol === "file:") {
      return "ws://localhost:4000/ws";
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${window.location.hostname}:4000/ws`;
  }

  function setConnectionState(label, className) {
    connectionStatus.textContent = label;
    connectionStatus.className = `connection-pill ${className}`;
  }

  function setActivity(message) {
    activityValue.textContent = message;
  }

  async function refreshHealth() {
    try {
      const response = await fetch(`${getHttpBaseUrl()}/health`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Health check failed");
      }

      const data = await response.json();
      leaderValue.textContent = data.leader || "No leader";
      termValue.textContent = data.term ?? "-";
    } catch (error) {
      leaderValue.textContent = "Unavailable";
      termValue.textContent = "-";
    }
  }

  function scheduleReconnect() {
    if (state.reconnectHandle) {
      return;
    }

    state.reconnectHandle = window.setTimeout(() => {
      state.reconnectHandle = null;
      connect();
    }, 1200);
  }

  function connect() {
    setConnectionState("Connecting...", "status-connecting");
    const socket = new WebSocket(getWsUrl());
    state.socket = socket;

    socket.addEventListener("open", () => {
      setConnectionState("Connected", "status-online");
      setActivity("Connected to gateway");
      refreshHealth();

      if (state.pingHandle) {
        clearInterval(state.pingHandle);
      }

      state.pingHandle = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 15000);
    });

    socket.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          setActivity(data.message);
        }

        if (data.type === "leader") {
          leaderValue.textContent = data.leader || "No leader";
          termValue.textContent = data.term ?? "-";
        }

        if (data.type === "stroke" && data.stroke && window.drawingBoard) {
          window.drawingBoard.drawRemoteStroke(data.stroke);
        }

        if (data.type === "error") {
          if (window.drawingBoard && typeof window.drawingBoard.handleGatewayError === "function") {
            window.drawingBoard.handleGatewayError(data.message);
          } else {
            setActivity(data.message);
          }
        }
      } catch (error) {
        setActivity("Received unreadable gateway message");
      }
    });

    socket.addEventListener("close", () => {
      setConnectionState("Disconnected", "status-offline");
      setActivity("Gateway connection lost, retrying...");
      if (state.pingHandle) {
        clearInterval(state.pingHandle);
        state.pingHandle = null;
      }
      scheduleReconnect();
    });

    socket.addEventListener("error", () => {
      setConnectionState("Disconnected", "status-offline");
      setActivity("Gateway socket error, retrying...");
      socket.close();
    });
  }

  window.gatewaySocket = {
    sendStroke(stroke) {
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
        setActivity("Cannot send stroke while gateway is offline");
        return false;
      }

      state.socket.send(
        JSON.stringify({
          type: "stroke",
          stroke
        })
      );

      return true;
    }
  };

  refreshHealth();
  state.healthHandle = window.setInterval(refreshHealth, 1500);
  connect();
})();
/**
   * Manages the WebSocket connection to the gateway server.
   * Handles auto-reconnect on disconnect, ping/pong keepalive,
   * and routes incoming messages to the drawing board module.
   */