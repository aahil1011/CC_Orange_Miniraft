const { log } = require("./logger");
const logStore = require("./logStore");

function parsePeers() {
  return (process.env.PEERS || "")
    .split(",")
    .map((peer) => peer.trim())
    .filter(Boolean);
}

function randomElectionTimeout() {
  return Math.floor(Math.random() * 301) + 500;
}

function strokesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const raftNode = {
  state: "follower",
  currentTerm: 0,
  votedFor: null,
  leaderId: null,
  replicaId: process.env.REPLICA_ID || "replica2",
  peers: parsePeers(),
  electionTimer: null,
  heartbeatTimer: null,
  voteCount: 0,
  nextIndex: {},
  matchIndex: {},
  ackCounts: {},
  onCommit: null,
  syncInProgress: false,
  needsSync: false,
  lastSyncedTerm: -1,

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
      this.lastSyncedTerm = -1;
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

    this.peers = rpcClient.getPeers();
    this.nextIndex = {};
    this.matchIndex = {};
    this.ackCounts = {};
    this.syncInProgress = false;
    this.needsSync = false;
    this.lastSyncedTerm = this.currentTerm;

    this.peers.forEach((peerUrl) => {
      const peerId = rpcClient.getPeerId(peerUrl);
      this.nextIndex[peerId] = logStore.getLength();
      this.matchIndex[peerId] = -1;
    });

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
    this.scheduleSyncFromLeader();
    return true;
  },

  appendStroke(stroke) {
    const rpcClient = require("./rpcClient");

    if (this.state !== "leader") {
      throw new Error("Only the leader can append strokes");
    }

    const entry = logStore.append(this.currentTerm, stroke);
    this.ackCounts[entry.index] = 1;

    log(`Entry appended to log at index ${entry.index}`);
    void rpcClient.broadcastAppendEntries(entry);
    return entry;
  },

  receiveAppendAck(fromPeerId, entryIndex, term, success) {
    if (term > this.currentTerm) {
      this.becomeFollower(term);
      return;
    }

    if (this.state !== "leader" || term !== this.currentTerm) {
      return;
    }

    if (!success) {
      return;
    }

    this.ackCounts[entryIndex] = (this.ackCounts[entryIndex] || 1) + 1;
    this.matchIndex[fromPeerId] = entryIndex;
    this.nextIndex[fromPeerId] = entryIndex + 1;

    if (this.ackCounts[entryIndex] >= this.getMajorityCount()) {
      const committedEntries = logStore.commit(entryIndex);

      if (committedEntries.length > 0) {
        log(`Entry committed through index ${entryIndex}`);
        if (typeof this.onCommit === "function") {
          this.onCommit(committedEntries);
        }
      }
    }
  },

  receiveAppendEntries(term, leaderId, entry, prevLogIndex, prevLogTerm) {
    if (term < this.currentTerm) {
      return {
        success: false,
        term: this.currentTerm,
        logLength: logStore.getLength()
      };
    }

    this.becomeFollower(term);
    this.leaderId = leaderId;
    log(`AppendEntries received from ${leaderId} for index ${entry.index}`);

    if (prevLogIndex >= 0) {
      const prevEntry = logStore.getEntry(prevLogIndex);

      if (prevEntry === null) {
        this.needsSync = true;
        this.scheduleSyncFromLeader(true);
        return {
          success: false,
          term: this.currentTerm,
          logLength: logStore.getLength()
        };
      }

      if (prevEntry.term !== prevLogTerm) {
        logStore.truncateFrom(prevLogIndex);
        this.needsSync = true;
        this.scheduleSyncFromLeader(true);
        return {
          success: false,
          term: this.currentTerm,
          logLength: logStore.getLength()
        };
      }
    }

    const existingEntry = logStore.getEntry(entry.index);
    if (existingEntry) {
      if (existingEntry.term === entry.term && strokesMatch(existingEntry.stroke, entry.stroke)) {
        return {
          success: true,
          term: this.currentTerm,
          logLength: logStore.getLength()
        };
      }

      logStore.truncateFrom(entry.index);
    }

    const appendedEntry = logStore.append(entry.term, entry.stroke);
    this.needsSync = false;
    this.lastSyncedTerm = this.currentTerm;

    log(`Entry appended to log at index ${appendedEntry.index}`);
    return {
      success: true,
      term: this.currentTerm,
      logLength: logStore.getLength()
    };
  },

  applySyncLog(entries) {
    let appliedCount = 0;

    entries.forEach((entry) => {
      if (entry.index >= logStore.getLength()) {
        logStore.append(entry.term, entry.stroke);
        appliedCount += 1;
      }
    });

    if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      const committedEntries = logStore.commit(lastEntry.index);
      if (committedEntries.length > 0 && typeof this.onCommit === "function") {
        this.onCommit(committedEntries);
      }
    }

    this.needsSync = false;
    this.lastSyncedTerm = this.currentTerm;
    log(`Catch-up entries applied: ${appliedCount} entries`);
  },

  async syncFromLeader(force = false) {
    const rpcClient = require("./rpcClient");

    if (this.state === "leader" || !this.leaderId || this.leaderId === this.replicaId || this.syncInProgress) {
      return;
    }

    if (!force && !this.needsSync && this.lastSyncedTerm === this.currentTerm) {
      return;
    }

    const leaderUrl = rpcClient.getPeerUrlById(this.leaderId);
    if (!leaderUrl) {
      return;
    }

    this.syncInProgress = true;

    try {
      const result = await rpcClient.sendSyncLog(leaderUrl, logStore.getLength());
      if (result && Array.isArray(result.entries)) {
        this.applySyncLog(result.entries);
      }
    } finally {
      this.syncInProgress = false;
    }
  },

  scheduleSyncFromLeader(force = false) {
    void this.syncFromLeader(force);
  },

  getMajorityCount() {
    return Math.floor((this.peers.length + 1) / 2) + 1;
  }
};

module.exports = raftNode;

require("./rpcClient");
raftNode.resetElectionTimer();
