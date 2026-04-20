const axios = require("axios");
const { log } = require("./logger");

function parseReplicas() {
  return (process.env.REPLICAS || "")
    .split(",")
    .map((replicaUrl) => replicaUrl.trim())
    .filter(Boolean);
}

const leaderTracker = {
  currentLeaderUrl: null,
  currentLeaderTerm: null,
  replicas: parseReplicas(),
  polling: false,
  intervalHandle: null,

  start() {
    if (this.polling) {
      return;
    }

    this.replicas = parseReplicas();
    this.polling = true;
    void this.poll();
    this.intervalHandle = setInterval(() => {
      void this.poll();
    }, 1000);
  },

  async poll() {
    let discoveredLeaderUrl = null;
    let discoveredLeaderTerm = null;

    for (const replicaUrl of this.replicas) {
      try {
        const response = await axios.get(`${replicaUrl}/status`, {
          timeout: 500
        });

        if (response.data.state === "leader") {
          discoveredLeaderUrl = replicaUrl;
          discoveredLeaderTerm = response.data.currentTerm ?? null;
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (discoveredLeaderUrl) {
      if (this.currentLeaderUrl === null) {
        log(`Leader discovered at ${discoveredLeaderUrl}`);
      } else if (this.currentLeaderUrl !== discoveredLeaderUrl) {
        log(`Leader changed to ${discoveredLeaderUrl}`);
      }

      this.currentLeaderUrl = discoveredLeaderUrl;
      this.currentLeaderTerm = discoveredLeaderTerm;
      return;
    }

    log("Leader poll failed, retrying");
    this.currentLeaderUrl = null;
    this.currentLeaderTerm = null;
  },

  getLeader() {
    return this.currentLeaderUrl;
  },

  getLeaderTerm() {
    return this.currentLeaderTerm;
  },

  isLeaderKnown() {
    return this.currentLeaderUrl !== null;
  }
};

module.exports = leaderTracker;
