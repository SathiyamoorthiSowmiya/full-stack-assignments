const { buildTestContext, createRoom, bookingBody, MONDAY, TUESDAY, SATURDAY } = require("./helpers");

async function book(ctx, room, day, start, end) {
  const res = await ctx.api().post("/bookings").send(
    bookingBody(room.id, { startTime: `${day}T${start}:00Z`, endTime: `${day}T${end}:00Z` })
  );
  expect(res.status).toBe(201);
  return res.body;
}

describe("GET /reports/room-utilization", () => {
  test("no bookings in range: 0 hours, 0 utilization for every room", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx, { name: "Empty" });
    const res = await ctx.api().get(`/reports/room-utilization?from=${MONDAY}&to=2030-01-11`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ roomId: room.id, roomName: "Empty", totalBookingHours: 0, utilizationPercent: 0 }]);
  });

  test("calculates hours and utilization over a business week", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx, { name: "Busy" });
    await book(ctx, room, MONDAY, "10:00", "12:30");  // 2.5h
    await book(ctx, room, TUESDAY, "14:00", "16:00"); // 2h

    const res = await ctx.api().get(`/reports/room-utilization?from=${MONDAY}&to=2030-01-11`);
    expect(res.body[0]).toEqual({ roomId: room.id, roomName: "Busy", totalBookingHours: 4.5, utilizationPercent: 0.075 });
  });

  test("a booking that starts before `from` only counts the part inside the range", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    await book(ctx, room, MONDAY, "10:00", "12:00");
    const res = await ctx.api().get(`/reports/room-utilization?from=${MONDAY}T11:00:00Z&to=${MONDAY}T13:00:00Z`);
    expect(res.body[0]).toMatchObject({ totalBookingHours: 1, utilizationPercent: 0.5 });
  });

  test("a booking that ends after `to` only counts the part inside the range", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    await book(ctx, room, MONDAY, "12:00", "14:00");
    const res = await ctx.api().get(`/reports/room-utilization?from=${MONDAY}T11:00:00Z&to=${MONDAY}T13:00:00Z`);
    expect(res.body[0]).toMatchObject({ totalBookingHours: 1, utilizationPercent: 0.5 });
  });

  test("cancelled bookings are not counted", async () => {
    const ctx = buildTestContext();
    const room = await createRoom(ctx);
    const booking = await book(ctx, room, MONDAY, "10:00", "12:00");
    await ctx.api().post(`/bookings/${booking.id}/cancel`);
    const res = await ctx.api().get(`/reports/room-utilization?from=${MONDAY}&to=${MONDAY}`);
    expect(res.body[0].totalBookingHours).toBe(0);
  });

  test("a weekend-only range has no business hours, so utilization is 0", async () => {
    const ctx = buildTestContext();
    await createRoom(ctx);
    const res = await ctx.api().get(`/reports/room-utilization?from=${SATURDAY}&to=2030-01-13`);
    expect(res.status).toBe(200);
    expect(res.body[0].utilizationPercent).toBe(0);
  });

  test("returns one row per room", async () => {
    const ctx = buildTestContext();
    const a = await createRoom(ctx, { name: "A" });
    await createRoom(ctx, { name: "B" });
    await book(ctx, a, MONDAY, "10:00", "11:00");
    const res = await ctx.api().get(`/reports/room-utilization?from=${MONDAY}&to=${MONDAY}`);
    expect(res.body.map((r) => r.roomName)).toEqual(["A", "B"]);
    expect(res.body[0].totalBookingHours).toBe(1);
    expect(res.body[0].utilizationPercent).toBeCloseTo(1 / 12, 4);
  });

  test.each([
    ["missing from", `to=${MONDAY}`],
    ["missing to", `from=${MONDAY}`],
    ["bad date", "from=abc&to=def"],
    ["from after to", `from=${TUESDAY}&to=${MONDAY}`],
    ["range longer than a year", "from=2030-01-01&to=2032-01-01"],
  ])("%s returns 400", async (_label, query) => {
    const res = await buildTestContext().api().get(`/reports/room-utilization?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});
