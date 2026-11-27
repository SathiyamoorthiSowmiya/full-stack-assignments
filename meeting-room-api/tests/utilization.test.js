const { DateTime } = require("luxon");
const { businessMillisInRange, computeUtilization } = require("../src/domain/utilization");

const at = (iso, zone = "UTC") => DateTime.fromISO(iso, { zone });
const booking = (start, end) => ({ startTime: new Date(start), endTime: new Date(end) });
const HOUR = 3600000;

describe("business hours in a range", () => {
  test("one full Mon-Fri week is 5 x 12 hours", () => {
    expect(businessMillisInRange(at("2030-01-07"), at("2030-01-12"), "UTC")).toBe(60 * HOUR);
  });
  test("weekends add nothing", () => {
    expect(businessMillisInRange(at("2030-01-12"), at("2030-01-14"), "UTC")).toBe(0);
  });
  test("a partial day only counts the part inside business hours", () => {
    expect(businessMillisInRange(at("2030-01-07T11:00:00Z"), at("2030-01-07T13:00:00Z"), "UTC")).toBe(2 * HOUR);
    expect(businessMillisInRange(at("2030-01-07T18:00:00Z"), at("2030-01-07T23:00:00Z"), "UTC")).toBe(2 * HOUR);
  });
  test("uses the room time zone", () => {
    // 02:30Z-14:30Z is 08:00-20:00 in Kolkata (UTC+5:30)
    const hours = businessMillisInRange(at("2030-01-07T00:00:00Z"), at("2030-01-07T23:59:00Z"), "Asia/Kolkata");
    expect(hours).toBe(12 * HOUR);
  });
});

describe("utilization", () => {
  const week = { rangeStart: at("2030-01-07"), rangeEnd: at("2030-01-12"), zone: "UTC" };

  test("no bookings in range gives 0 hours and 0 utilization", () => {
    expect(computeUtilization({ bookings: [], ...week })).toEqual({ totalBookingHours: 0, utilizationPercent: 0 });
  });

  test("sums booked hours and divides by business hours", () => {
    const bookings = [
      booking("2030-01-07T10:00:00Z", "2030-01-07T12:30:00Z"), // 2.5h
      booking("2030-01-08T14:00:00Z", "2030-01-08T16:00:00Z"), // 2h
    ];
    expect(computeUtilization({ bookings, ...week })).toEqual({
      totalBookingHours: 4.5,
      utilizationPercent: 0.075, // 4.5 / 60
    });
  });

  test("a booking that starts before `from` only counts the part inside", () => {
    const result = computeUtilization({
      bookings: [booking("2030-01-07T10:00:00Z", "2030-01-07T12:00:00Z")],
      rangeStart: at("2030-01-07T11:00:00Z"),
      rangeEnd: at("2030-01-07T13:00:00Z"),
      zone: "UTC",
    });
    expect(result).toEqual({ totalBookingHours: 1, utilizationPercent: 0.5 });
  });

  test("a booking that ends after `to` only counts the part inside", () => {
    const result = computeUtilization({
      bookings: [booking("2030-01-07T12:00:00Z", "2030-01-07T14:00:00Z")],
      rangeStart: at("2030-01-07T11:00:00Z"),
      rangeEnd: at("2030-01-07T13:00:00Z"),
      zone: "UTC",
    });
    expect(result).toEqual({ totalBookingHours: 1, utilizationPercent: 0.5 });
  });

  test("a range with no business hours does not divide by zero", () => {
    const result = computeUtilization({
      bookings: [], rangeStart: at("2030-01-12"), rangeEnd: at("2030-01-14"), zone: "UTC",
    });
    expect(result.utilizationPercent).toBe(0);
  });
});
