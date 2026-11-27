const { randomUUID } = require("crypto");
const { overlaps } = require("../../domain/bookingRules");

class MemoryBookingRepository {
  constructor() {
    this.bookings = new Map();
  }

  async create(booking) {
    const saved = { ...booking, id: randomUUID(), status: "confirmed", cancelledAt: null };
    this.bookings.set(saved.id, saved);
    return { ...saved };
  }

  async findById(id) {
    const booking = this.bookings.get(id);
    return booking ? { ...booking } : null;
  }

  async findByIdempotency(organizerEmail, key) {
    for (const b of this.bookings.values()) {
      if (b.organizerEmail === organizerEmail && b.idempotencyKey === key) return { ...b };
    }
    return null;
  }

  /** Confirmed bookings of one room that overlap [start, end). Cancelled ones never block. */
  async findConfirmedOverlapping(roomId, start, end) {
    return [...this.bookings.values()]
      .filter((b) => b.roomId === roomId && b.status === "confirmed")
      .filter((b) => overlaps(b.startTime, b.endTime, start, end))
      .map((b) => ({ ...b }));
  }

  async list({ roomId, from, to, limit, offset }) {
    const matching = [...this.bookings.values()]
      .filter((b) => !roomId || b.roomId === roomId)
      .filter((b) => !from || b.endTime > from)
      .filter((b) => !to || b.startTime < to)
      .sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
    return {
      items: matching.slice(offset, offset + limit).map((b) => ({ ...b })),
      total: matching.length,
    };
  }

  /** Only a confirmed booking is changed; returns the booking as it is afterwards. */
  async cancel(id, cancelledAt) {
    const booking = this.bookings.get(id);
    if (!booking) return null;
    if (booking.status === "confirmed") {
      booking.status = "cancelled";
      booking.cancelledAt = cancelledAt;
    }
    return { ...booking };
  }
}

module.exports = { MemoryBookingRepository };
