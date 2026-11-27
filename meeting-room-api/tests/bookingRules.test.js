const { DateTime } = require("luxon");
const { overlaps, isWithinBusinessHours, validateBookingTimes } = require("../src/domain/bookingRules");
const { ValidationError } = require("../src/errors");

const at = (iso, zone = "UTC") => DateTime.fromISO(iso, { zone });
const check = (start, end, zone) => () => validateBookingTimes(at(start, zone), at(end, zone));

describe("overlap", () => {
  const d = (h) => new Date(`2030-01-07T${String(h).padStart(2, "0")}:00:00Z`);

  test("partial overlap on either side", () => {
    expect(overlaps(d(10), d(12), d(11), d(13))).toBe(true);
    expect(overlaps(d(11), d(13), d(10), d(12))).toBe(true);
  });
  test("one booking fully inside another", () => {
    expect(overlaps(d(9), d(14), d(10), d(11))).toBe(true);
  });
  test("identical times overlap", () => {
    expect(overlaps(d(10), d(11), d(10), d(11))).toBe(true);
  });
  test("back-to-back bookings do not overlap", () => {
    expect(overlaps(d(10), d(11), d(11), d(12))).toBe(false);
    expect(overlaps(d(11), d(12), d(10), d(11))).toBe(false);
  });
  test("separate bookings do not overlap", () => {
    expect(overlaps(d(9), d(10), d(12), d(13))).toBe(false);
  });
});

describe("duration", () => {
  test("startTime must be before endTime", () => {
    expect(check("2030-01-07T11:00:00", "2030-01-07T10:00:00")).toThrow("startTime must be before endTime");
    expect(check("2030-01-07T10:00:00", "2030-01-07T10:00:00")).toThrow("startTime must be before endTime");
  });
  test("15 minutes is the minimum", () => {
    expect(check("2030-01-07T10:00:00", "2030-01-07T10:14:00")).toThrow("at least 15 minutes");
    expect(check("2030-01-07T10:00:00", "2030-01-07T10:15:00")).not.toThrow();
  });
  test("4 hours is the maximum", () => {
    expect(check("2030-01-07T09:00:00", "2030-01-07T13:00:00")).not.toThrow();
    expect(check("2030-01-07T09:00:00", "2030-01-07T13:01:00")).toThrow("not be more than 4 hours");
  });
  test("throws a ValidationError", () => {
    expect(check("2030-01-07T11:00:00", "2030-01-07T10:00:00")).toThrow(ValidationError);
  });
});

describe("working hours (Mon-Fri 08:00-20:00, room local time)", () => {
  test("inside the window is fine, edges included", () => {
    expect(check("2030-01-07T08:00:00", "2030-01-07T09:00:00")).not.toThrow();
    expect(check("2030-01-07T19:00:00", "2030-01-07T20:00:00")).not.toThrow();
  });
  test("starting before 08:00 is rejected", () => {
    expect(check("2030-01-07T07:45:00", "2030-01-07T09:00:00")).toThrow("Monday to Friday");
  });
  test("ending after 20:00 is rejected", () => {
    expect(check("2030-01-07T19:30:00", "2030-01-07T20:15:00")).toThrow("Monday to Friday");
  });
  test("a booking that crosses midnight is rejected", () => {
    expect(check("2030-01-07T23:00:00", "2030-01-08T00:30:00")).toThrow("Monday to Friday");
  });
  test("weekends are rejected", () => {
    expect(check("2030-01-12T10:00:00", "2030-01-12T11:00:00")).toThrow("Monday to Friday"); // Saturday
    expect(check("2030-01-13T10:00:00", "2030-01-13T11:00:00")).toThrow("Monday to Friday"); // Sunday
    expect(check("2030-01-11T10:00:00", "2030-01-11T11:00:00")).not.toThrow();               // Friday
  });
  test("uses the room's own time zone", () => {
    // 09:00-10:00 in Kolkata is fine even though it is 03:30 UTC
    expect(isWithinBusinessHours(at("2030-01-07T09:00:00", "Asia/Kolkata"), at("2030-01-07T10:00:00", "Asia/Kolkata"))).toBe(true);
    // The same instants read in UTC are before 08:00
    expect(isWithinBusinessHours(at("2030-01-07T03:30:00Z", "UTC"), at("2030-01-07T04:30:00Z", "UTC"))).toBe(false);
  });
});
