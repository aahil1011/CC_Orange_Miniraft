const dotenv = require("dotenv");

dotenv.config();

const path = require("path");
const http = require("http");
const express = require("express");
const leaderTracker = require("./leaderTracker");
const setupWebSocket = require("./wsHandler");
const { log } = require("./logger");

const app = express();
const server = http.createServer(app);
const port = Number(process.env.GATEWAY_PORT) || 4000;
const frontendDir = path.resolve(__dirname, "..", "frontend");

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use(express.static(frontendDir));

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    leader: leaderTracker.getLeader(),
    term: leaderTracker.getLeaderTerm()
  });
});

setupWebSocket(server);
leaderTracker.start();

server.listen(port, () => {
  log(`Gateway running on port ${port}`);
});
