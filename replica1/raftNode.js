const { log } = require("./logger");

function parsePeers() {
  return (process.env.PEERS || "")
    .split(",")
    .map((peer) => peer.trim())
    .filter(Boolean);
}

/**
 * Generates a randomized election timeout to avoid split votes.
 * Timeout range: 500ms–800ms as per RAFT specification.
 * @returns {number} Randomized timeout in milliseconds
 */

function randomElectionTimeout() {
  return Math.floor(Math.random() * 301) + 500;
}

const raftNode = {
  state: "follower",
  currentTerm: 0,
  votedFor: null,
  leaderId: null,
  replicaId: process.env.REPLICA_ID || "replica1",
  peers: parsePeers(),
  electionTimer: null,
  heartbeatTimer: null,
  voteCount: 0,

  resetElectionTimer() {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
    }

    const timeout = randomElectionTimeout();
    this.electionTimer = setTimeout(() => {
      if (this.state === "leader") {
        return;
      }

      if (this.state === "candidate") {
        log("Split vote detected");
      }

      this.becomeCandidate();
    }, timeout);
  },

  stopHeartbeatTimer() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },

  becomeFollower(term) {
    const previousState = this.state;
    const nextTerm = Math.max(this.currentTerm, term);
    const termAdvanced = nextTerm > this.currentTerm;

    this.state = "follower";
    this.currentTerm = nextTerm;
    if (termAdvanced) {
      this.votedFor = null;
      this.leaderId = null;
    }
    this.voteCount = 0;
    this.stopHeartbeatTimer();
    this.resetElectionTimer();

    if (previousState !== "follower" || termAdvanced) {
      log(`State transition to follower for term ${this.currentTerm}`);
    }
  },

  async becomeCandidate() {
    const rpcClient = require("./rpcClient");

    this.state = "candidate";
    this.currentTerm += 1;
    this.votedFor = this.replicaId;
    this.leaderId = null;
    this.voteCount = 1;
    this.stopHeartbeatTimer();
    this.resetElectionTimer();

    log(`State transition to candidate for term ${this.currentTerm}`);
    log(`Election started for term ${this.currentTerm}`);

    await rpcClient.broadcastRequestVote();

    if (this.state === "candidate" && this.voteCount >= this.getMajorityCount()) {
      this.becomeLeader();
    }
  },

  becomeLeader() {
    const rpcClient = require("./rpcClient");

    if (this.state === "leader") {
      return;
    }

    this.state = "leader";
    this.leaderId = this.replicaId;

    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      this.electionTimer = null;
    }

    this.stopHeartbeatTimer();
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== "leader") {
        this.stopHeartbeatTimer();
        return;
      }

      void rpcClient.broadcastHeartbeat();
    }, 150);

    log(`State transition to leader for term ${this.currentTerm}`);
    void rpcClient.broadcastHeartbeat();
  },

  receiveVote(granted, term) {
    if (term > this.currentTerm) {
      this.becomeFollower(term);
      return;
    }

    if (this.state !== "candidate" || term !== this.currentTerm) {
      return;
    }

    if (granted) {
      this.voteCount += 1;
      if (this.voteCount >= this.getMajorityCount()) {
        this.becomeLeader();
      }
    }
  },

  receiveHeartbeat(term, fromLeaderId) {
    if (term < this.currentTerm) {
      return false;
    }

    log(`Heartbeat received from ${fromLeaderId}`);

    if (term > this.currentTerm) {
      this.becomeFollower(term);
    } else {
      if (this.state !== "follower") {
        this.state = "follower";
        this.stopHeartbeatTimer();
        log(`State transition to follower for term ${this.currentTerm}`);
      }
      this.resetElectionTimer();
      this.voteCount = 0;
    }

    this.leaderId = fromLeaderId;
    return true;
  },


  /**
 * Calculates the minimum vote count needed for a quorum.
 * For a 3-node cluster, majority is 2 votes.
 * @returns {number} Minimum votes required to win election
 */


  getMajorityCount() {
    return Math.floor((this.peers.length + 1) / 2) + 1;
  }
};

module.exports = raftNode;

require("./rpcClient");
raftNode.resetElectionTimer();
"// RAFT Node - follower state initialization" 
"// Randomized election timer logic" 
"// Candidate state and self-vote" 
