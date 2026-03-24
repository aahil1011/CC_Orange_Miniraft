const axios = require("axios");
const raftNode = require("./raftNode");
const { log } = require("./logger");

function getPeers() {
  return (process.env.PEERS || "")
    .split(",")
    .map((peer) => peer.trim())
    .filter(Boolean);
}

async function sendRequestVote(peerUrl) {
  try {
    const response = await axios.post(
      `${peerUrl}/request-vote`,
      {
        term: raftNode.currentTerm,
        candidateId: raftNode.replicaId
      },
      {
        timeout: 200
      }
    );

    raftNode.receiveVote(response.data.voteGranted, response.data.term);
  } catch (error) {
    return;
  }
}

async function sendHeartbeat(peerUrl) {
  log(`Heartbeat sent to ${peerUrl}`);

  try {
    const response = await axios.post(
      `${peerUrl}/heartbeat`,
      {
        term: raftNode.currentTerm,
        leaderId: raftNode.replicaId
      },
      {
        timeout: 100
      }
    );

    if (response.data.term > raftNode.currentTerm) {
      raftNode.becomeFollower(response.data.term);
    }
  } catch (error) {
    return;
  }
}

async function broadcastRequestVote() {
  raftNode.peers = getPeers();
  await Promise.allSettled(raftNode.peers.map((peerUrl) => sendRequestVote(peerUrl)));
}

async function broadcastHeartbeat() {
  raftNode.peers = getPeers();
  await Promise.allSettled(raftNode.peers.map((peerUrl) => sendHeartbeat(peerUrl)));
}

module.exports = {
  getPeers,
  sendRequestVote,
  sendHeartbeat,
  broadcastRequestVote,
  broadcastHeartbeat
};
