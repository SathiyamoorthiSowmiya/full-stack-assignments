const { IdempotencyKey } = require("./models");
const { isDuplicateKeyError } = require("./helpers");

const toRecord = (doc) => ({
  organizerEmail: doc.organizerEmail,
  key: doc.key,
  requestHash: doc.requestHash,
  status: doc.status,
  bookingId: doc.bookingId ? String(doc.bookingId) : null,
  createdAt: doc.createdAt,
});

class MongoIdempotencyRepository {
  /** The unique index on (organizerEmail, key) makes this atomic across any number of processes. */
  async claim({ organizerEmail, key, requestHash, now }) {
    try {
      await IdempotencyKey.create({ organizerEmail, key, requestHash, status: "in_progress", createdAt: now });
      return { claimed: true };
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      return { claimed: false, record: await this.get(organizerEmail, key) }; // null if released meanwhile
    }
  }

  async get(organizerEmail, key) {
    const doc = await IdempotencyKey.findOne({ organizerEmail, key }).lean();
    return doc ? toRecord(doc) : null;
  }

  async complete(organizerEmail, key, bookingId) {
    await IdempotencyKey.updateOne({ organizerEmail, key }, { $set: { status: "completed", bookingId } });
  }

  async release(organizerEmail, key) {
    await IdempotencyKey.deleteOne({ organizerEmail, key, status: "in_progress" });
  }

  async takeOverStale({ organizerEmail, key, requestHash, staleBefore, now }) {
    const doc = await IdempotencyKey.findOneAndUpdate(
      { organizerEmail, key, status: "in_progress", createdAt: { $lt: staleBefore } },
      { $set: { createdAt: now, requestHash } },
      { new: true }
    ).lean();
    return Boolean(doc);
  }
}

module.exports = { MongoIdempotencyRepository };
