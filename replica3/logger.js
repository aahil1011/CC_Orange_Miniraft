function log(message) {
  const replicaId = process.env.REPLICA_ID || "unknown-replica";

  let currentTerm = 0;
  let state = "follower";

  try {
    const raftNode = require("./raftNode");
    currentTerm = raftNode.currentTerm;
    state = raftNode.state;
  } catch (error) {
    currentTerm = 0;
    state = "follower";
  }

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${replicaId}][TERM:${currentTerm}][${state}] ${message}`);
}

module.exports = {
  log
};
