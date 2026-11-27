const { OPEN_HOUR, CLOSE_HOUR } = require("./bookingRules");

const HOUR_MS = 3600000;
const round = (value, digits) => Number(value.toFixed(digits));

/**
 * Milliseconds of business time (Mon-Fri, 08:00-20:00 in `zone`) inside [rangeStart, rangeEnd].
 * Walks day by day, so partial first/last days and weekends are handled naturally.
 */
function businessMillisInRange(rangeStart, rangeEnd, zone) {
  const from = rangeStart.setZone(zone);
  const fromMs = from.toMillis();
  const toMs = rangeEnd.toMillis();

  let total = 0;
  let day = from.startOf("day");
  while (day.toMillis() < toMs) {
    if (day.weekday <= 5) {
      const open = day.set({ hour: OPEN_HOUR }).toMillis();
      const close = day.set({ hour: CLOSE_HOUR }).toMillis();
      const start = Math.max(open, fromMs);
      const end = Math.min(close, toMs);
      if (end > start) total += end - start;
    }
    day = day.plus({ days: 1 }).startOf("day");
  }
  return total;
}

/**
 * utilization = booked hours inside [from, to] / business hours inside [from, to].
 * Bookings are clipped to the range, so a booking that starts before `from`
 * or ends after `to` only counts the part inside.
 */
function computeUtilization({ bookings, rangeStart, rangeEnd, zone }) {
  const fromMs = rangeStart.toMillis();
  const toMs = rangeEnd.toMillis();

  let bookedMs = 0;
  for (const booking of bookings) {
    const start = Math.max(booking.startTime.getTime(), fromMs);
    const end = Math.min(booking.endTime.getTime(), toMs);
    if (end > start) bookedMs += end - start;
  }

  const businessMs = businessMillisInRange(rangeStart, rangeEnd, zone);
  return {
    totalBookingHours: round(bookedMs / HOUR_MS, 2),
    utilizationPercent: businessMs === 0 ? 0 : round(bookedMs / businessMs, 4), // fraction 0..1
  };
}

module.exports = { businessMillisInRange, computeUtilization };
