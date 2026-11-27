const { buildTestContext, createRoom, bookingBody, MONDAY, TUESDAY, SATURDAY } = require("./helpers");
const { MemoryBookingRepository } = require("../src/repositories/memory/bookingRepository");

describe("POST /bookings", () => {
  test("happy path: confirmed booking", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const res = await ctx.api().post("/bookings").send(bookingBody(room.id));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      roomId: room.id,
      title: "Sprint planning",
      organizerEmail: "asha@example.com",
      startTime: `${MONDAY}T10:00:00.000Z`,
      endTime: `${MONDAY}T11:00:00.000Z`,
      status: "confirmed",
    });
    expect(res.body.id).toBeDefined();
  });

  test("overlapping booking for the same room returns 409", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    await ctx.api().post("/bookings").send(bookingBody(room.id));
    const res = await ctx.api().post("/bookings").send(
      bookingBody(room.id, { startTime: `${MONDAY}T10:30:00Z`, endTime: `${MONDAY}T11:30:00Z` })
    );
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ConflictError");
    expect(res.body.message).toMatch(/already booked/);
  });

  test("back-to-back bookings are allowed", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    await ctx.api().post("/bookings").send(bookingBody(room.id));
    const res = await ctx.api().post("/bookings").send(
      bookingBody(room.id, { startTime: `${MONDAY}T11:00:00Z`, endTime: `${MONDAY}T12:00:00Z` })
    );
    expect(res.status).toBe(201);
  });

  test("the same time in a different room is allowed", async () => {
    const ctx = buildTestContext();
    const [a, b] = [await createRoom(ctx), await createRoom(ctx)];
    await ctx.api().post("/bookings").send(bookingBody(a.id));
    expect((await ctx.api().post("/bookings").send(bookingBody(b.id))).status).toBe(201);
  });

  test("unknown room returns 404", async () => {
    const res = await buildTestContext().api().post("/bookings").send(bookingBody("does-not-exist"));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NotFoundError");
  });

  test("a numeric roomId is accepted and treated as unknown if no such room exists", async () => {
    const res = await buildTestContext().api().post("/bookings").send(bookingBody(42));
    expect(res.status).toBe(404);
  });

  test.each([
    ["missing title", { title: "" }, "title"],
    ["bad email", { organizerEmail: "not-an-email" }, "organizerEmail"],
    ["bad startTime", { startTime: "tomorrow" }, "startTime"],
    ["bad endTime", { endTime: 123 }, "endTime"],
    ["end before start", { startTime: `${MONDAY}T11:00:00Z`, endTime: `${MONDAY}T10:00:00Z` }, "startTime must be before endTime"],
    ["too short", { endTime: `${MONDAY}T10:10:00Z` }, "at least 15 minutes"],
    ["too long", { startTime: `${MONDAY}T09:00:00Z`, endTime: `${MONDAY}T13:30:00Z` }, "4 hours"],
    ["before opening", { startTime: `${MONDAY}T07:00:00Z`, endTime: `${MONDAY}T08:30:00Z` }, "Monday to Friday"],
    ["after closing", { startTime: `${MONDAY}T19:30:00Z`, endTime: `${MONDAY}T20:30:00Z` }, "Monday to Friday"],
    ["on a Saturday", { startTime: `${SATURDAY}T10:00:00Z`, endTime: `${SATURDAY}T11:00:00Z` }, "Monday to Friday"],
  ])("%s returns 400", async (_label, overrides, expectedText) => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const res = await ctx.api().post("/bookings").send(bookingBody(room.id, overrides));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.message).toContain(expectedText);
  });

  test("working hours are checked in the room's local time", async () => {
    const ctx = buildTestContext();
    const kolkata = await createRoom(ctx, { timezone: "Asia/Kolkata" });

    // 04:00Z = 09:30 in Kolkata: allowed
    const ok = await ctx.api().post("/bookings").send(
      bookingBody(kolkata.id, { startTime: `${MONDAY}T04:00:00Z`, endTime: `${MONDAY}T05:00:00Z` })
    );
    expect(ok.status).toBe(201);

    // 14:00Z-15:00Z = 19:30-20:30 in Kolkata: past closing
    const late = await ctx.api().post("/bookings").send(
      bookingBody(kolkata.id, { startTime: `${MONDAY}T14:00:00Z`, endTime: `${MONDAY}T15:00:00Z` })
    );
    expect(late.status).toBe(400);
  });

  test("a time without an offset is read as the room's local time", async () => {
    const ctx = buildTestContext();
    const kolkata = await createRoom(ctx, { timezone: "Asia/Kolkata" });
    const res = await ctx.api().post("/bookings").send(
      bookingBody(kolkata.id, { startTime: `${MONDAY}T10:00:00`, endTime: `${MONDAY}T11:00:00` })
    );
    expect(res.status).toBe(201);
    expect(res.body.startTime).toBe(`${MONDAY}T04:30:00.000Z`);
  });

  test("two parallel requests for the same slot: exactly one wins", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        ctx.api().post("/bookings").send(bookingBody(room.id, { organizerEmail: `user${i}@example.com` }))
      )
    );
    const statuses = responses.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
  });
});

describe("concurrency: the per-room lock", () => {
  // A slow database makes the gap between "check for overlap" and "insert" wide.
  // Without the lock, every request below would pass the check before any of them inserted.
  class SlowBookingRepository extends MemoryBookingRepository {
    async findConfirmedOverlapping(...args) {
      const result = await super.findConfirmedOverlapping(...args);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return result;
    }
  }

  test("only one booking is saved when the overlap check is slow", async () => {
    const ctx = buildTestContext({ repos: { bookingRepo: new SlowBookingRepository() } });
    const room = await createRoom(ctx);
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        ctx.api().post("/bookings").send(bookingBody(room.id, { organizerEmail: `user${i}@example.com` }))
      )
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(5);
    expect((await ctx.api().get("/bookings")).body.total).toBe(1);
  });

  test("different rooms do not block each other", async () => {
    const ctx = buildTestContext({ repos: { bookingRepo: new SlowBookingRepository() } });
    const rooms = await Promise.all([createRoom(ctx), createRoom(ctx), createRoom(ctx)]);
    const responses = await Promise.all(rooms.map((r) => ctx.api().post("/bookings").send(bookingBody(r.id))));
    expect(responses.every((r) => r.status === 201)).toBe(true);
  });
});

describe("POST /bookings with Idempotency-Key", () => {
  const post = (ctx, body, key) => ctx.api().post("/bookings").set("Idempotency-Key", key).send(body);

  test("the same key and body returns the same booking, no duplicate", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const first = await post(ctx, bookingBody(room.id), "key-1");
    const second = await post(ctx, bookingBody(room.id), "key-1");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(first.headers["idempotent-replayed"]).toBeUndefined();

    const list = await ctx.api().get("/bookings");
    expect(list.body.total).toBe(1);
  });

  test("concurrent requests with the same key create exactly one booking", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const responses = await Promise.all(Array.from({ length: 8 }, () => post(ctx, bookingBody(room.id), "key-race")));

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
    expect((await ctx.api().get("/bookings")).body.total).toBe(1);
  });

  test("the same key with a different body returns 422", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    await post(ctx, bookingBody(room.id), "key-2");
    const res = await post(ctx, bookingBody(room.id, { title: "Something else" }), "key-2");
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("IdempotencyKeyReuse");
  });

  test("keys are scoped per organizer", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const a = await post(ctx, bookingBody(room.id, { organizerEmail: "a@example.com" }), "shared-key");
    const b = await post(
      ctx,
      bookingBody(room.id, { organizerEmail: "b@example.com", startTime: `${MONDAY}T13:00:00Z`, endTime: `${MONDAY}T14:00:00Z` }),
      "shared-key"
    );
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.id).not.toBe(a.body.id);
  });

  test("a failed request does not burn the key", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const blocker = await ctx.api().post("/bookings").send(bookingBody(room.id, { organizerEmail: "other@example.com" }));

    const failed = await post(ctx, bookingBody(room.id), "key-retry");
    expect(failed.status).toBe(409);

    // Free the slot, then retry with the same key: it works and is not treated as a replay
    await ctx.api().post(`/bookings/${blocker.body.id}/cancel`);
    const retry = await post(ctx, bookingBody(room.id), "key-retry");
    expect(retry.status).toBe(201);
    expect(retry.headers["idempotent-replayed"]).toBeUndefined();
  });

  test("survives a restart: a fresh app on the same storage still replays the key", async () => {
    const first = buildTestContext();
    const room = await createRoom(first);
    const created = await post(first, bookingBody(room.id), "key-restart");

    const afterRestart = buildTestContext({ repos: first.repos }); // new services, same database
    const replay = await post(afterRestart, bookingBody(room.id), "key-restart");
    expect(replay.status).toBe(201);
    expect(replay.body.id).toBe(created.body.id);
    expect((await afterRestart.api().get("/bookings")).body.total).toBe(1);
  });

  test("a key left 'in progress' by a crashed request is taken over", async () => {
    const ctx = buildTestContext({ idempotency: { staleMs: 1000 } });
    const room = await createRoom(ctx);
    const body = bookingBody(room.id);

    // Simulate a process that claimed the key 10 seconds ago and then died
    const { validateCreateBooking } = require("../src/validation");
    const crypto = require("crypto");
    const n = validateCreateBooking(body);
    const requestHash = crypto.createHash("sha256")
      .update(JSON.stringify([n.roomId, n.title, n.organizerEmail, n.startTime, n.endTime])).digest("hex");
    await ctx.repos.idempotencyRepo.claim({
      organizerEmail: n.organizerEmail, key: "key-crash", requestHash, now: new Date(Date.now() - 10000),
    });

    const res = await post(ctx, body, "key-crash");
    expect(res.status).toBe(201);
    expect((await ctx.api().get("/bookings")).body.total).toBe(1);
  });

  test("a key that is still in progress and not stale answers 409 after the wait", async () => {
    const ctx = buildTestContext({ idempotency: { waitMs: 50, pollMs: 5 } });
    const room = await createRoom(ctx);
    const body = bookingBody(room.id);
    const { validateCreateBooking } = require("../src/validation");
    const crypto = require("crypto");
    const n = validateCreateBooking(body);
    const requestHash = crypto.createHash("sha256")
      .update(JSON.stringify([n.roomId, n.title, n.organizerEmail, n.startTime, n.endTime])).digest("hex");
    await ctx.repos.idempotencyRepo.claim({ organizerEmail: n.organizerEmail, key: "key-busy", requestHash, now: new Date() });

    const res = await post(ctx, body, "key-busy");
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/still being processed/);
  });

  test("an empty Idempotency-Key header returns 400", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const res = await ctx.api().post("/bookings").set("Idempotency-Key", "   ").send(bookingBody(room.id));
    expect(res.status).toBe(400);
  });
});

describe("POST /bookings/:id/cancel", () => {
  // Booking starts Monday 10:00Z. The cut-off is Monday 09:00Z.
  async function setup(now) {
    const ctx = buildTestContext({ now });
    const room = await createRoom(ctx);
    const booking = (await ctx.api().post("/bookings").send(bookingBody(room.id))).body;
    return { ctx, room, booking };
  }

  test("can cancel well before the start", async () => {
    const { ctx, booking } = await setup("2030-01-01T00:00:00Z");
    const res = await ctx.api().post(`/bookings/${booking.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("cancelled");
    expect(res.body.cancelledAt).not.toBeNull();
  });

  test("can cancel exactly 1 hour before the start", async () => {
    const { ctx, booking } = await setup("2030-01-01T00:00:00Z");
    ctx.clock.current = new Date(`${MONDAY}T09:00:00Z`);
    expect((await ctx.api().post(`/bookings/${booking.id}/cancel`)).status).toBe(200);
  });

  test("cannot cancel less than 1 hour before the start", async () => {
    const { ctx, booking } = await setup("2030-01-01T00:00:00Z");
    ctx.clock.current = new Date(`${MONDAY}T09:00:01Z`);
    const res = await ctx.api().post(`/bookings/${booking.id}/cancel`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.message).toMatch(/up to 1 hour before/);

    const stillThere = await ctx.api().get("/bookings");
    expect(stillThere.body.items[0].status).toBe("confirmed");
  });

  test("cancelling twice returns the same cancelled booking", async () => {
    const { ctx, booking } = await setup("2030-01-01T00:00:00Z");
    const first = await ctx.api().post(`/bookings/${booking.id}/cancel`);
    ctx.clock.current = new Date(`${MONDAY}T09:30:00Z`); // past the cut-off now, still a no-op
    const second = await ctx.api().post(`/bookings/${booking.id}/cancel`);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
  });

  test("unknown booking returns 404", async () => {
    const res = await buildTestContext().api().post("/bookings/nope/cancel");
    expect(res.status).toBe(404);
  });

  test("a cancelled booking no longer blocks the slot", async () => {
    const { ctx, room, booking } = await setup("2030-01-01T00:00:00Z");
    await ctx.api().post(`/bookings/${booking.id}/cancel`);
    const rebook = await ctx.api().post("/bookings").send(bookingBody(room.id, { organizerEmail: "new@example.com" }));
    expect(rebook.status).toBe(201);
  });
});

describe("GET /bookings", () => {
  async function seeded() {
    const ctx = buildTestContext();
    const [a, b] = [await createRoom(ctx), await createRoom(ctx)];
    const slots = [
      [a, MONDAY, "08:00", "09:00"],
      [a, MONDAY, "10:00", "11:00"],
      [a, TUESDAY, "10:00", "11:00"],
      [b, MONDAY, "10:00", "11:00"],
    ];
    for (const [room, day, s, e] of slots) {
      await ctx.api().post("/bookings").send(bookingBody(room.id, { startTime: `${day}T${s}:00Z`, endTime: `${day}T${e}:00Z` }));
    }
    return { ctx, a, b };
  }

  test("returns items, total, limit and offset", async () => {
    const { ctx } = await seeded();
    const res = await ctx.api().get("/bookings");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 4, limit: 20, offset: 0 });
    expect(res.body.items).toHaveLength(4);
  });

  test("filters by roomId", async () => {
    const { ctx, b } = await seeded();
    const res = await ctx.api().get(`/bookings?roomId=${b.id}`);
    expect(res.body.total).toBe(1);
  });

  test("filters by time range (bookings overlapping from..to)", async () => {
    const { ctx } = await seeded();
    const res = await ctx.api().get(`/bookings?from=${MONDAY}T09:30:00Z&to=${MONDAY}T10:30:00Z`);
    expect(res.body.total).toBe(2); // both Monday 10:00 bookings
  });

  test("a date-only `to` includes that whole day", async () => {
    const { ctx } = await seeded();
    const res = await ctx.api().get(`/bookings?from=${MONDAY}&to=${MONDAY}`);
    expect(res.body.total).toBe(3);
  });

  test("paginates with limit and offset, in start-time order", async () => {
    const { ctx } = await seeded();
    const page1 = await ctx.api().get("/bookings?limit=3&offset=0");
    const page2 = await ctx.api().get("/bookings?limit=3&offset=3");
    expect(page1.body.items).toHaveLength(3);
    expect(page2.body.items).toHaveLength(1);
    expect(page1.body.total).toBe(4);
    expect(page2.body).toMatchObject({ limit: 3, offset: 3, total: 4 });
    const starts = [...page1.body.items, ...page2.body.items].map((b) => b.startTime);
    expect(starts).toEqual([...starts].sort());
  });

  test.each([
    ["limit=0"], ["limit=101"], ["limit=abc"], ["offset=-1"], ["from=yesterday"],
    [`from=${MONDAY}T12:00:00Z&to=${MONDAY}T10:00:00Z`],
  ])("rejects bad query %s with 400", async (query) => {
    const res = await buildTestContext().api().get(`/bookings?${query}`);
    expect(res.status).toBe(400);
  });
});
