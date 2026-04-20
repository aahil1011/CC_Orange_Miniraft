const express = require("express");
const raftNode = require("./raftNode");
const logStore = require("./logStore");
const { log } = require("./logger");

const router = express.Router();

router.post("/request-vote", (req, res) => {
  const { term, candidateId } = req.body;

  if (term < raftNode.currentTerm) {
    log(`Vote denied to ${candidateId} for stale term ${term}`);
    return res.json({
      voteGranted: false,
      term: raftNode.currentTerm
    });
  }

  if (term > raftNode.currentTerm) {
    raftNode.becomeFollower(term);
  }

  if (raftNode.votedFor === null || raftNode.votedFor === candidateId) {
    raftNode.votedFor = candidateId;
    raftNode.resetElectionTimer();
    log(`Vote granted to ${candidateId} for term ${raftNode.currentTerm}`);
    return res.json({
      voteGranted: true,
      term: raftNode.currentTerm
    });
  }

  log(`Vote denied to ${candidateId} for term ${raftNode.currentTerm}`);
  return res.json({
    voteGranted: false,
    term: raftNode.currentTerm
  });
});

router.post("/heartbeat", (req, res) => {
  const { term, leaderId } = req.body;

  // ✅ Keep this validation (important)
  if (!leaderId || term === undefined) {
    return res.status(400).json({
      error: "Missing required fields: term, leaderId"
    });
  }

  const success = raftNode.receiveHeartbeat(term, leaderId);

  if (!success) {
    return res.json({
      success: false,
      term: raftNode.currentTerm
    });
  }

  return res.json({
    success: true,
    term: raftNode.currentTerm
  });
});

router.post("/append-entries", (req, res) => {
  const { term, leaderId, entry, prevLogIndex, prevLogTerm } = req.body;
  const result = raftNode.receiveAppendEntries(
    term,
    leaderId,
    entry,
    prevLogIndex,
    prevLogTerm
  );
  return res.json(result);
});

router.post("/stroke", (req, res) => {
  if (raftNode.state !== "leader") {
    return res.status(403).json({
      error: "not leader",
      leaderId: raftNode.leaderId
    });
  }

  const { stroke } = req.body;
  raftNode.appendStroke(stroke);

  return res.status(200).json({
    success: true,
    message: "stroke accepted"
  });
});

router.post("/sync-log", (req, res) => {
  const fromIndex = Number.isInteger(req.body.fromIndex)
    ? req.body.fromIndex
    : Number(req.body.fromIndex) || 0;

  const entries = logStore.getEntriesFrom(fromIndex);

  log(`Sync-log requested from index ${fromIndex}`);
  log(`Sync-log sent ${entries.length} entries from index ${fromIndex}`);

  return res.json({
    entries
  });
});

router.get("/status", (req, res) => {
  res.json({
    replicaId: raftNode.replicaId,
    state: raftNode.state,
    currentTerm: raftNode.currentTerm,
    votedFor: raftNode.votedFor,
    leaderId: raftNode.leaderId,
    peers: raftNode.peers,
    logLength: logStore.getLength(),
    commitIndex: logStore.commitIndex
  });
});

raftNode.onCommit = function onCommit(committedEntries) {
  committedEntries.forEach((entry) => {
    log(`Committed stroke at index ${entry.index}`);
  });
};

module.exports = router;