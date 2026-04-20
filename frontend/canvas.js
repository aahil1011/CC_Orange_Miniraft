(function setupCanvas() {
  const canvas = document.getElementById("boardCanvas");
  const context = canvas.getContext("2d");
  const activityValue = document.getElementById("activityValue");
  const brushWidthInput = document.getElementById("brushWidth");
  const brushWidthValue = document.getElementById("brushWidthValue");
  const colorButtons = Array.from(document.querySelectorAll(".color-swatch"));
  const committedStrokeIds = new Set();
  const committedStrokeHistory = [];
  const pendingStrokes = new Map();

  const state = {
    clientId:
      (window.crypto && typeof window.crypto.randomUUID === "function" && window.crypto.randomUUID()) ||
      `client-${Math.random().toString(16).slice(2)}`,
    strokeSequence: 0,
    drawing: false,
    color: "#ff6b35",
    width: Number(brushWidthInput.value),
    lastPoint: null
  };
  /**
   * Sets up the collaborative drawing canvas.
   * Handles pointer events, stroke rendering, and gateway sync.
   * Supports mouse, stylus, and touch input via the Pointer Events API.
   */

  function setActivity(message) {
    activityValue.textContent = message;
  }

  function resizeCanvas() {
    const stage = canvas.parentElement;
    const pixelRatio = window.devicePixelRatio || 1;
    const width = stage.clientWidth;
    const height = stage.clientHeight;

    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    redrawAllStrokes();
  }

  function toNormalizedPoint(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  }

  function drawStrokeSegment(stroke, alpha = 1) {
    const rect = canvas.getBoundingClientRect();

    context.save();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(stroke.x1 * rect.width, stroke.y1 * rect.height);
    context.lineTo(stroke.x2 * rect.width, stroke.y2 * rect.height);
    context.stroke();
    context.restore();
  }

  function redrawAllStrokes() {
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    committedStrokeHistory.forEach((stroke) => drawStrokeSegment(stroke, 1));
    pendingStrokes.forEach((stroke) => drawStrokeSegment(stroke, 0.35));
  }

  function schedulePendingExpiry(strokeId) {
    window.setTimeout(() => {
      if (pendingStrokes.delete(strokeId)) {
        redrawAllStrokes();
        setActivity("Stroke was not confirmed by the leader");
      }
    }, 2200);
  }
/**
   * Commits a stroke to the permanent canvas history.
   * Removes it from pending state and deduplicates using stroke ID.
   * This prevents echo - strokes sent by this client are not re-rendered
   * when they arrive back from the gateway broadcast.
   * @param {object} stroke - The confirmed stroke to commit
   */
  function commitStroke(stroke) {
    pendingStrokes.delete(stroke.id);

    if (committedStrokeIds.has(stroke.id)) {
      redrawAllStrokes();
      return;
    }

    committedStrokeIds.add(stroke.id);
    committedStrokeHistory.push(stroke);
    redrawAllStrokes();
  }
  /**
   * Constructs and publishes a stroke segment to the gateway.
   * Stroke is added to pending state immediately for visual feedback,
   * then confirmed or discarded based on gateway response.
   * @param {{x: number, y: number}} startPoint - Normalized start coordinates
   * @param {{x: number, y: number}} endPoint - Normalized end coordinates
   */
  function publishStroke(startPoint, endPoint) {
    const stroke = {
      id: `${state.clientId}-${Date.now()}-${state.strokeSequence++}`,
      clientId: state.clientId,
      x1: startPoint.x,
      y1: startPoint.y,
      x2: endPoint.x,
      y2: endPoint.y,
      color: state.color,
      width: state.width,
      createdAt: new Date().toISOString()
    };

    pendingStrokes.set(stroke.id, stroke);
    redrawAllStrokes();
    schedulePendingExpiry(stroke.id);

    if (window.gatewaySocket && typeof window.gatewaySocket.sendStroke === "function") {
      const sent = window.gatewaySocket.sendStroke(stroke);

      if (sent) {
        setActivity("Sending stroke to gateway...");
        return;
      }
    } else {
      setActivity("Gateway connection is not ready");
    }

    pendingStrokes.delete(stroke.id);
    redrawAllStrokes();
  }

  function stopDrawing() {
    state.drawing = false;
    state.lastPoint = null;
  }

  canvas.addEventListener("pointerdown", (event) => {
    state.drawing = true;
    state.lastPoint = toNormalizedPoint(event);
    canvas.setPointerCapture(event.pointerId);
    setActivity("Drawing live...");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.drawing || !state.lastPoint) {
      return;
    }

    const nextPoint = toNormalizedPoint(event);
    publishStroke(state.lastPoint, nextPoint);
    state.lastPoint = nextPoint;
  });

  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);
  canvas.addEventListener("pointerleave", stopDrawing);

  brushWidthInput.addEventListener("input", () => {
    state.width = Number(brushWidthInput.value);
    brushWidthValue.textContent = `${state.width}px`;
  });

  colorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.color = button.dataset.color;
      colorButtons.forEach((candidate) => candidate.classList.remove("is-active"));
      button.classList.add("is-active");
      setActivity(`Brush updated to ${state.color}`);
    });
  });

  window.addEventListener("resize", resizeCanvas);

  window.drawingBoard = {
    drawRemoteStroke(stroke) {
      commitStroke(stroke);
      setActivity("Board synced from gateway");
    },
    handleGatewayError(message) {
      pendingStrokes.clear();
      redrawAllStrokes();
      setActivity(message);
    },
    setActivity
  };

  brushWidthValue.textContent = `${state.width}px`;
  resizeCanvas();
})();
