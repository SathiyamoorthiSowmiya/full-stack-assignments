const { Booking } = require("./models");
const { isObjectIdString } = require("./helpers");

const toBooking = (doc) => ({
  id: String(doc._id),
  roomId: String(doc.roomId),
  title: doc.title,
  organizerEmail: doc.organizerEmail,
  startTime: doc.startTime,
  endTime: doc.endTime,
  status: doc.status,
  idempotencyKey: doc.idempotencyKey || null,
  createdAt: doc.createdAt,
  cancelledAt: doc.cancelledAt || null,
});

class MongoBookingRepository {
  async create(booking) {
    const doc = await Booking.create({ ...booking, status: "confirmed" });
    return toBooking(doc.toObject());
  }

  async findById(id) {
    if (!isObjectIdString(id)) return null;
    const doc = await Booking.findById(id).lean();
    return doc ? toBooking(doc) : null;
  }

  async findByIdempotency(organizerEmail, key) {
    const doc = await Booking.findOne({ organizerEmail, idempotencyKey: key }).lean();
    return doc ? toBooking(doc) : null;
  }

  async findConfirmedOverlapping(roomId, start, end) {
    if (!isObjectIdString(roomId)) return [];
    const docs = await Booking.find({
      roomId,
      status: "confirmed",
      startTime: { $lt: end },
      endTime: { $gt: start },
    }).lean();
    return docs.map(toBooking);
  }

  async list({ roomId, from, to, limit, offset }) {
    const filter = {};
    if (roomId) {
      if (!isObjectIdString(roomId)) return { items: [], total: 0 };
      filter.roomId = roomId;
    }
    if (from) filter.endTime = { $gt: from };
    if (to) filter.startTime = { $lt: to };

    const [docs, total] = await Promise.all([
      Booking.find(filter).sort({ startTime: 1, _id: 1 }).skip(offset).limit(limit).lean(),
      Booking.countDocuments(filter),
    ]);
    return { items: docs.map(toBooking), total };
  }

  async cancel(id, cancelledAt) {
    if (!isObjectIdString(id)) return null;
    const updated = await Booking.findOneAndUpdate(
      { _id: id, status: "confirmed" },
      { $set: { status: "cancelled", cancelledAt } },
      { new: true }
    ).lean();
    if (updated) return toBooking(updated);
    return this.findById(id); // already cancelled (or missing)
  }
}

module.exports = { MongoBookingRepository };
