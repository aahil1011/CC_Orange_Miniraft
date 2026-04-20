const logStore = {
  entries: [],
  commitIndex: -1,

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

  truncateFrom(index) {
    const safeIndex = Math.max(index, this.commitIndex + 1);
    if (safeIndex < this.entries.length) {
      this.entries = this.entries.slice(0, safeIndex);
    }
  }
};

module.exports = logStore;
