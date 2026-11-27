const request = require("supertest");
const { createApp } = require("../src/app");
const { buildServices } = require("../src/container");
const { MemoryRoomRepository } = require("../src/repositories/memory/roomRepository");
const { MemoryBookingRepository } = require("../src/repositories/memory/bookingRepository");
const { MemoryIdempotencyRepository } = require("../src/repositories/memory/idempotencyRepository");

// 2030-01-07 is a Monday. "Now" in tests is before it, so bookings are in the future.
const MONDAY = "2030-01-07";
const TUESDAY = "2030-01-08";
const SATURDAY = "2030-01-12";

function buildTestContext({ now = "2030-01-01T00:00:00Z", defaultTimezone = "UTC", idempotency = {}, repos } = {}) {
  const roomRepo = repos?.roomRepo || new MemoryRoomRepository();
  const bookingRepo = repos?.bookingRepo || new MemoryBookingRepository();
  const idempotencyRepo = repos?.idempotencyRepo || new MemoryIdempotencyRepository();

  const clock = { current: new Date(now) };
  const config = {
    defaultTimezone,
    idempotency: { waitMs: 2000, pollMs: 5, staleMs: 30000, ...idempotency },
  };
  const services = buildServices({ roomRepo, bookingRepo, idempotencyRepo, config, now: () => clock.current });
  const app = createApp(services);

  return { app, api: () => request(app), clock, repos: { roomRepo, bookingRepo, idempotencyRepo }, config };
}

async function createRoom(ctx, overrides = {}) {
  const res = await ctx.api().post("/rooms").send({
    name: `Room ${Math.random().toString(36).slice(2, 8)}`,
    capacity: 8,
    floor: 2,
    amenities: ["projector"],
    ...overrides,
  });
  if (res.status !== 201) throw new Error(`createRoom failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const bookingBody = (roomId, overrides = {}) => ({
  roomId,
  title: "Sprint planning",
  organizerEmail: "asha@example.com",
  startTime: `${MONDAY}T10:00:00Z`,
  endTime: `${MONDAY}T11:00:00Z`,
  ...overrides,
});

module.exports = { buildTestContext, createRoom, bookingBody, MONDAY, TUESDAY, SATURDAY };
