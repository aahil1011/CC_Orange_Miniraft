const axios = require("axios");
const raftNode = require("./raftNode");
const logStore = require("./logStore");
const { log } = require("./logger");

function getPeers() {
  return (process.env.PEERS || "")
    .split(",")
    .map((peer) => peer.trim())
    .filter(Boolean);
}

function getPeerId(peerUrl) {
  try {
    return new URL(peerUrl).hostname;
  } catch (error) {
    return peerUrl;
  }
}

function getPeerUrlById(peerId) {
  return getPeers().find((peerUrl) => getPeerId(peerUrl) === peerId) || null;
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
/**
 * Sends an AppendEntries RPC to a single peer replica.
 * Includes previous log index and term for consistency checks.
 * @param {string} peerUrl - Target peer URL
 * @param {object} entry - Log entry to replicate
 */
async function sendAppendEntries(peerUrl, entry) {
  const peerId = getPeerId(peerUrl);
  const prevLogIndex = entry.index - 1;
  const prevLogTerm = prevLogIndex >= 0 ? (logStore.getEntry(prevLogIndex) || { term: 0 }).term : 0;

  try {
    const response = await axios.post(
      `${peerUrl}/append-entries`,
      {
        term: raftNode.currentTerm,
        leaderId: raftNode.replicaId,
        entry,
        prevLogIndex,
        prevLogTerm
      },
      {
        timeout: 300
      }
    );

    raftNode.receiveAppendAck(peerId, entry.index, response.data.term, response.data.success);
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

async function broadcastAppendEntries(entry) {
  raftNode.peers = getPeers();
  await Promise.allSettled(raftNode.peers.map((peerUrl) => sendAppendEntries(peerUrl, entry)));
}

async function sendSyncLog(peerUrl, fromIndex) {
  try {
    const response = await axios.post(
      `${peerUrl}/sync-log`,
      {
        fromIndex
      },
      {
        timeout: 500
      }
    );

    return response.data;
  } catch (error) {
    return null;
  }
}

module.exports = {
  getPeers,
  getPeerId,
  getPeerUrlById,
  sendRequestVote,
  sendHeartbeat,
  sendAppendEntries,
  broadcastRequestVote,
  broadcastHeartbeat,
  broadcastAppendEntries,
  sendSyncLog
};
