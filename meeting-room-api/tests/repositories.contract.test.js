// The same checks run against the in-memory repositories always, and against MongoDB
// too when MONGODB_URI_TEST is set:  MONGODB_URI_TEST=mongodb://127.0.0.1:27017/meeting-rooms-test npm test
const { randomUUID } = require("crypto");
const { ConflictError } = require("../src/errors");
const { MemoryRoomRepository } = require("../src/repositories/memory/roomRepository");
const { MemoryBookingRepository } = require("../src/repositories/memory/bookingRepository");
const { MemoryIdempotencyRepository } = require("../src/repositories/memory/idempotencyRepository");

const factories = {
  memory: async () => ({
    roomRepo: new MemoryRoomRepository(),
    bookingRepo: new MemoryBookingRepository(),
    idempotencyRepo: new MemoryIdempotencyRepository(),
    close: async () => {},
  }),
};

if (process.env.MONGODB_URI_TEST) {
  factories.mongo = async () => {
    const mongoose = require("mongoose");
    const { connectMongo } = require("../src/repositories/mongo/connect");
    const { MongoRoomRepository } = require("../src/repositories/mongo/roomRepository");
    const { MongoBookingRepository } = require("../src/repositories/mongo/bookingRepository");
    const { MongoIdempotencyRepository } = require("../src/repositories/mongo/idempotencyRepository");
    await connectMongo(process.env.MONGODB_URI_TEST);
    return {
      roomRepo: new MongoRoomRepository(),
      bookingRepo: new MongoBookingRepository(),
      idempotencyRepo: new MongoIdempotencyRepository(),
      close: () => mongoose.disconnect(),
    };
  };
}

describe.each(Object.keys(factories))("%s repositories", (name) => {
  let repos;
  const uid = randomUUID().slice(0, 8); // keeps test data unique on a shared database
  beforeAll(async () => { repos = await factories[name](); });
  afterAll(async () => { await repos.close(); });

  const roomData = (suffix, extra = {}) => ({
    name: `Room-${uid}-${suffix}`, capacity: 6, floor: 1, amenities: [`amenity-${uid}`], timezone: "UTC", ...extra,
  });
  const at = (h) => new Date(`2030-01-07T${String(h).padStart(2, "0")}:00:00Z`);

  test("room names are unique ignoring case", async () => {
    await repos.roomRepo.create(roomData("dup"));
    await expect(repos.roomRepo.create(roomData("dup", { name: `ROOM-${uid}-DUP` }))).rejects.toBeInstanceOf(ConflictError);
  });

  test("rooms can be filtered by capacity and amenity", async () => {
    const small = await repos.roomRepo.create(roomData("small", { capacity: 2 }));
    const big = await repos.roomRepo.create(roomData("big", { capacity: 30 }));
    const byAmenity = await repos.roomRepo.list({ amenity: `AMENITY-${uid}` });
    expect(byAmenity.map((r) => r.id)).toEqual(expect.arrayContaining([small.id, big.id]));
    const large = await repos.roomRepo.list({ minCapacity: 30, amenity: `amenity-${uid}` });
    expect(large.map((r) => r.id)).toEqual([big.id]);
  });

  test("an unknown or malformed id is simply not found", async () => {
    expect(await repos.roomRepo.findById("not-a-real-id")).toBeNull();
    expect(await repos.bookingRepo.findById("not-a-real-id")).toBeNull();
  });

  test("overlap query only returns confirmed bookings that overlap", async () => {
    const room = await repos.roomRepo.create(roomData("overlap"));
    const base = { roomId: room.id, title: "t", organizerEmail: "a@example.com", idempotencyKey: null, createdAt: new Date() };
    const booking = await repos.bookingRepo.create({ ...base, startTime: at(10), endTime: at(11) });

    expect(await repos.bookingRepo.findConfirmedOverlapping(room.id, at(10), at(11))).toHaveLength(1);
    expect(await repos.bookingRepo.findConfirmedOverlapping(room.id, at(11), at(12))).toHaveLength(0); // back-to-back
    expect(await repos.bookingRepo.findConfirmedOverlapping(room.id, at(9), at(10))).toHaveLength(0);

    const cancelled = await repos.bookingRepo.cancel(booking.id, new Date());
    expect(cancelled.status).toBe("cancelled");
    expect(await repos.bookingRepo.findConfirmedOverlapping(room.id, at(10), at(11))).toHaveLength(0);
    expect((await repos.bookingRepo.cancel(booking.id, new Date())).status).toBe("cancelled"); // no-op
  });

  test("idempotency keys: second claim fails, complete and release work", async () => {
    const args = { organizerEmail: `${uid}@example.com`, key: "k1", requestHash: "h", now: new Date() };
    expect((await repos.idempotencyRepo.claim(args)).claimed).toBe(true);

    const second = await repos.idempotencyRepo.claim(args);
    expect(second.claimed).toBe(false);
    expect(second.record.status).toBe("in_progress");

    const bookingId = (await repos.roomRepo.create(roomData("idem"))).id; // any valid id
    await repos.idempotencyRepo.complete(args.organizerEmail, "k1", bookingId);
    expect((await repos.idempotencyRepo.get(args.organizerEmail, "k1")).status).toBe("completed");

    await repos.idempotencyRepo.release(args.organizerEmail, "k1"); // completed keys are never released
    expect(await repos.idempotencyRepo.get(args.organizerEmail, "k1")).not.toBeNull();

    const other = { ...args, key: "k2" };
    await repos.idempotencyRepo.claim(other);
    await repos.idempotencyRepo.release(other.organizerEmail, "k2");
    expect(await repos.idempotencyRepo.get(other.organizerEmail, "k2")).toBeNull();
  });

  test("only one of many concurrent claims wins", async () => {
    const args = { organizerEmail: `${uid}-race@example.com`, key: "race", requestHash: "h", now: new Date() };
    const results = await Promise.all(Array.from({ length: 10 }, () => repos.idempotencyRepo.claim(args)));
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
  });
});
