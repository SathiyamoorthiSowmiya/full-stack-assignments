const { buildTestContext, createRoom } = require("./helpers");

describe("POST /rooms", () => {
  test("creates a room and returns it with an id", async () => {
    const ctx = buildTestContext();
    const res = await ctx.api().post("/rooms").send({ name: "Orion", capacity: 10, floor: 3, amenities: ["tv", "whiteboard"] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Orion", capacity: 10, floor: 3, amenities: ["tv", "whiteboard"], timezone: "UTC" });
    expect(res.body.id).toBeDefined();
  });

  test("name must be unique, ignoring case", async () => {
    const ctx = buildTestContext();
    await createRoom(ctx, { name: "Orion" });
    const res = await ctx.api().post("/rooms").send({ name: "ORION", capacity: 4, floor: 1, amenities: [] });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("ConflictError");
  });

  test.each([
    ["missing name", { capacity: 4, floor: 1 }, "name"],
    ["blank name", { name: "  ", capacity: 4, floor: 1 }, "name"],
    ["zero capacity", { name: "A", capacity: 0, floor: 1 }, "capacity"],
    ["negative capacity", { name: "A", capacity: -2, floor: 1 }, "capacity"],
    ["decimal capacity", { name: "A", capacity: 2.5, floor: 1 }, "capacity"],
    ["text capacity", { name: "A", capacity: "4", floor: 1 }, "capacity"],
    ["missing floor", { name: "A", capacity: 4 }, "floor"],
    ["amenities not an array", { name: "A", capacity: 4, floor: 1, amenities: "tv" }, "amenities"],
    ["bad timezone", { name: "A", capacity: 4, floor: 1, timezone: "Mars/Base" }, "timezone"],
  ])("rejects %s with 400", async (_label, body, field) => {
    const res = await buildTestContext().api().post("/rooms").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(res.body.message).toContain(field);
  });

  test("rejects a body that is not valid JSON with the same error shape", async () => {
    const res = await buildTestContext().api().post("/rooms").set("Content-Type", "application/json").send("{ oops");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "ValidationError", message: "Request body is not valid JSON" });
  });
});

describe("GET /rooms", () => {
  async function seeded() {
    const ctx = buildTestContext();
    await createRoom(ctx, { name: "Small", capacity: 4, amenities: ["tv"] });
    await createRoom(ctx, { name: "Medium", capacity: 8, amenities: ["projector", "TV"] });
    await createRoom(ctx, { name: "Large", capacity: 20, amenities: ["projector"] });
    return ctx;
  }

  test("returns all rooms when no filters are given", async () => {
    const res = await (await seeded()).api().get("/rooms");
    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.name)).toEqual(["Large", "Medium", "Small"]);
  });

  test("minCapacity filter", async () => {
    const res = await (await seeded()).api().get("/rooms?minCapacity=8");
    expect(res.body.map((r) => r.name)).toEqual(["Large", "Medium"]);
  });

  test("amenity filter ignores case", async () => {
    const res = await (await seeded()).api().get("/rooms?amenity=tv");
    expect(res.body.map((r) => r.name)).toEqual(["Medium", "Small"]);
  });

  test("filters can be combined", async () => {
    const res = await (await seeded()).api().get("/rooms?minCapacity=10&amenity=projector");
    expect(res.body.map((r) => r.name)).toEqual(["Large"]);
  });

  test("invalid minCapacity returns 400", async () => {
    const res = await buildTestContext().api().get("/rooms?minCapacity=lots");
    expect(res.status).toBe(400);
  });
});

test("unknown routes return the standard error shape", async () => {
  const res = await buildTestContext().api().get("/nope");
  expect(res.status).toBe(404);
  expect(res.body.error).toBe("NotFoundError");
});
