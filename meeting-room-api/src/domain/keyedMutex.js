/**
 * Runs async functions one at a time per key (e.g. per room).
 * In-memory, so it only protects a single Node process (see DESIGN.md).
 */
class KeyedMutex {
  constructor() {
    this.tails = new Map();
  }

  async run(key, fn) {
    const previous = this.tails.get(key) || Promise.resolve();
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    this.tails.set(key, tail);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}

module.exports = { KeyedMutex };
