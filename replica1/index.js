const dotenv = require("dotenv");

dotenv.config();

const express = require("express");
const rpcHandlers = require("./rpcHandlers");
const { log } = require("./logger");

const app = express();
const replicaId = process.env.REPLICA_ID || "replica1";
const port = Number(process.env.REPLICA_PORT) || 3001;

app.use(express.json());
app.use("/", rpcHandlers);

app.listen(port, () => {
  log(`Replica ${replicaId} listening on port ${port}`);
});
