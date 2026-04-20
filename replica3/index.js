const dotenv = require("dotenv");

dotenv.config();

const express = require("express");
const rpcHandlers = require("./rpcHandlers");
const logStore = require("./logStore");
const { log } = require("./logger");

const app = express();
const replicaId = process.env.REPLICA_ID || "replica3";
const port = Number(process.env.REPLICA_PORT) || 3003;

app.use(express.json());
app.use("/", rpcHandlers);

app.listen(port, () => {
  log(`Replica ${replicaId} listening on port ${port} - log replication ready (log length ${logStore.getLength()})`);
});
