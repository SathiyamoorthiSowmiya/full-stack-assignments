class MemoryIdempotencyRepository {
  constructor() {
    this.records = new Map();
  }

  _key(organizerEmail, key) {
    return `${organizerEmail}\u0000${key}`;
  }

  /** Atomic: the check and the insert happen with no await in between. */
  async claim({ organizerEmail, key, requestHash, now }) {
    const k = this._key(organizerEmail, key);
    const existing = this.records.get(k);
    if (existing) return { claimed: false, record: { ...existing } };
    this.records.set(k, { organizerEmail, key, requestHash, status: "in_progress", bookingId: null, createdAt: now });
    return { claimed: true };
  }

  async get(organizerEmail, key) {
    const record = this.records.get(this._key(organizerEmail, key));
    return record ? { ...record } : null;
  }

  async complete(organizerEmail, key, bookingId) {
    const record = this.records.get(this._key(organizerEmail, key));
    if (record) {
      record.status = "completed";
      record.bookingId = bookingId;
    }
  }

  async release(organizerEmail, key) {
    const k = this._key(organizerEmail, key);
    const record = this.records.get(k);
    if (record && record.status === "in_progress") this.records.delete(k);
  }

  /** Atomically takes over an "in progress" key whose owner looks crashed. */
  async takeOverStale({ organizerEmail, key, requestHash, staleBefore, now }) {
    const record = this.records.get(this._key(organizerEmail, key));
    if (record && record.status === "in_progress" && record.createdAt < staleBefore) {
      record.createdAt = now;
      record.requestHash = requestHash;
      return true;
    }
    return false;
  }
}

module.exports = { MemoryIdempotencyRepository };
