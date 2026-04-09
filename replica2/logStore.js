const logStore = {
  entries: [],
  commitIndex: -1,

  /**
 * Appends a new stroke entry to the log.
 * Each entry is assigned an index based on current log length.
 * @param {number} term - The current RAFT term
 * @param {object} stroke - The stroke data to store
 * @returns {object} The newly created log entry
 */

  append(term, stroke) {
    const entry = {
      index: this.entries.length,
      term,
      stroke
    };

    this.entries.push(entry);
    return entry;
  },

  getEntry(index) {
    return index >= 0 && index < this.entries.length ? this.entries[index] : null;
  },

  getLength() {
    return this.entries.length;
  },

  getLastIndex() {
    return this.entries.length - 1;
  },

  getLastTerm() {
    if (this.entries.length === 0) {
      return 0;
    }

    return this.entries[this.entries.length - 1].term;
  },

  /**
 * Commits all entries up to and including the given index.
 * Returns only newly committed entries since the last commit.
 * Ensures entries are not double-committed on repeated calls.
 * @param {number} index - Log index to commit up to
 * @returns {Array} Newly committed entries
 */

  commit(index) {
    if (index > this.commitIndex && index < this.entries.length) {
      const startIndex = this.commitIndex + 1;
      this.commitIndex = index;
      return this.entries.slice(startIndex, index + 1);
    }

    return [];
  },

  getEntriesFrom(startIndex) {
    return this.entries.slice(Math.max(0, startIndex));
  },

  /**
 * Removes conflicting log entries from the given index onward.
 * Protects already-committed entries from being truncated.
 * @param {number} index - Index from which to truncate
 */
  truncateFrom(index) {
    const safeIndex = Math.max(index, this.commitIndex + 1);
    if (safeIndex < this.entries.length) {
      this.entries = this.entries.slice(0, safeIndex);
    }
  }
};

module.exports = logStore;
