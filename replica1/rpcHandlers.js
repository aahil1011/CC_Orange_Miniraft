const express = require("express");
const raftNode = require("./raftNode");
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

router.get("/status", (req, res) => {
  res.json({
    replicaId: raftNode.replicaId,
    state: raftNode.state,
    currentTerm: raftNode.currentTerm,
    votedFor: raftNode.votedFor,
    leaderId: raftNode.leaderId,
    peers: raftNode.peers
  });
});

router.post('/stroke', (req, res) => {
  if (raftNode.state !== 'leader') {
    return res.status(403).json({ error: 'not leader', leaderId: raftNode.leaderId });
  }
  const { stroke } = req.body;
  if (!stroke) {
    return res.status(400).json({ error: 'stroke is required' });
  }
  log(`Stroke received: ${JSON.stringify(stroke)}`);
  res.status(200).json({ success: true, message: 'stroke accepted' });
});

module.exports = router;
