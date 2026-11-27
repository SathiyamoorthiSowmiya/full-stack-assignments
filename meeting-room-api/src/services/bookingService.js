const crypto = require("crypto");
const { ConflictError, NotFoundError, ValidationError, IdempotencyKeyReuseError } = require("../errors");
const { parseInstant } = require("../domain/timeUtils");
const { validateBookingTimes } = require("../domain/bookingRules");
const { KeyedMutex } = require("../domain/keyedMutex");
const { validateCreateBooking, validateListBookingsQuery } = require("../validation");

const CANCEL_CUTOFF_MS = 60 * 60 * 1000; // cancel up to 1 hour before start
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class BookingService {
  constructor({ roomRepo, bookingRepo, idempotencyRepo, idempotency, now = () => new Date() }) {
    this.roomRepo = roomRepo;
    this.bookingRepo = bookingRepo;
    this.idempotencyRepo = idempotencyRepo;
    this.idempotency = idempotency;
    this.now = now;
    this.roomLocks = new KeyedMutex();
  }

  /** Returns { booking, replayed }. `replayed` is true when an earlier result for the same key is returned. */
  async createBooking(body, idempotencyKey) {
    const input = validateCreateBooking(body);
    if (!idempotencyKey) {
      return { booking: await this._createBooking(input, null), replayed: false };
    }
    return this._createIdempotent(input, idempotencyKey);
  }

  async listBookings(query) {
    const filters = validateListBookingsQuery(query);
    const { items, total } = await this.bookingRepo.list(filters);
    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  async cancelBooking(id) {
    const booking = await this.bookingRepo.findById(id);
    if (!booking) throw new NotFoundError(`Booking "${id}" not found`);

    if (booking.status === "cancelled") return booking; // cancelling twice is a no-op

    const now = this.now();
    const cutoff = new Date(booking.startTime.getTime() - CANCEL_CUTOFF_MS);
    if (now.getTime() > cutoff.getTime()) {
      throw new ValidationError(
        `A booking can only be cancelled up to 1 hour before it starts (cancellation closed at ${cutoff.toISOString()})`
      );
    }
    return this.bookingRepo.cancel(id, now);
  }

  // ---- booking creation (business rules) ----

  async _createBooking(input, idempotencyKey) {
    const room = await this.roomRepo.findById(input.roomId);
    if (!room) throw new NotFoundError(`Room "${input.roomId}" not found`);

    const start = parseInstant(input.startTime, room.timezone);
    const end = parseInstant(input.endTime, room.timezone);
    validateBookingTimes(start, end);

    // The overlap check and the insert must not interleave with another booking for the same room.
    return this.roomLocks.run(`room:${room.id}`, async () => {
      const conflicts = await this.bookingRepo.findConfirmedOverlapping(room.id, start.toJSDate(), end.toJSDate());
      if (conflicts.length > 0) {
        throw new ConflictError(
          `Room "${room.name}" is already booked for part of this time (conflicting booking ${conflicts[0].id})`
        );
      }
      return this.bookingRepo.create({
        roomId: room.id,
        title: input.title,
        organizerEmail: input.organizerEmail,
        startTime: start.toJSDate(),
        endTime: end.toJSDate(),
        idempotencyKey,
        createdAt: this.now(),
      });
    });
  }

  // ---- idempotency ----

  async _createIdempotent(input, key) {
    const { organizerEmail } = input;
    const requestHash = hashRequest(input);
    const { waitMs, pollMs, staleMs } = this.idempotency;
    const deadline = Date.now() + waitMs;

    for (;;) {
      const claim = await this.idempotencyRepo.claim({ organizerEmail, key, requestHash, now: new Date() });

      if (claim.claimed) return this._runClaimed(input, key, false);

      const record = claim.record;
      if (!record) continue; // the first request failed and released the key: try to claim it ourselves

      if (record.requestHash !== requestHash) throw new IdempotencyKeyReuseError();

      if (record.status === "completed") {
        const booking = await this.bookingRepo.findById(record.bookingId);
        return { booking, replayed: true };
      }

      // Still in progress: the owner may have crashed (stale) or may still be running.
      const staleBefore = new Date(Date.now() - staleMs);
      if (record.createdAt < staleBefore) {
        const tookOver = await this.idempotencyRepo.takeOverStale({
          organizerEmail, key, requestHash, staleBefore, now: new Date(),
        });
        if (tookOver) return this._runClaimed(input, key, true);
        continue;
      }

      if (Date.now() >= deadline) {
        throw new ConflictError("A request with this Idempotency-Key is still being processed. Retry shortly.");
      }
      await sleep(pollMs);
    }
  }

  async _runClaimed(input, key, recovering) {
    const { organizerEmail } = input;

    if (recovering) {
      // The crashed attempt may have saved the booking before dying. Reuse it, never duplicate it.
      const existing = await this.bookingRepo.findByIdempotency(organizerEmail, key);
      if (existing) {
        await this.idempotencyRepo.complete(organizerEmail, key, existing.id);
        return { booking: existing, replayed: true };
      }
    }

    try {
      const booking = await this._createBooking(input, key);
      await this.idempotencyRepo.complete(organizerEmail, key, booking.id);
      return { booking, replayed: false };
    } catch (err) {
      // Only successful requests are remembered. A failed one frees the key so the client can retry.
      await this.idempotencyRepo.release(organizerEmail, key).catch(() => {});
      throw err;
    }
  }
}

function hashRequest({ roomId, title, organizerEmail, startTime, endTime }) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([roomId, title, organizerEmail, startTime, endTime]))
    .digest("hex");
}

module.exports = { BookingService };
