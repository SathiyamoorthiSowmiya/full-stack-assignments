const { ValidationError } = require("../errors");

const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 4 * 60;
const OPEN_HOUR = 8;   // 08:00
const CLOSE_HOUR = 20; // 20:00
const LAST_BUSINESS_WEEKDAY = 5; // Luxon: Monday = 1 ... Sunday = 7

/** Two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap. Back-to-back bookings do not. */
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/** `start` and `end` must already be in the room's time zone. */
function isWithinBusinessHours(start, end) {
  if (start.weekday > LAST_BUSINESS_WEEKDAY) return false;
  if (!start.hasSame(end, "day")) return false;
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;
  return startMinutes >= OPEN_HOUR * 60 && endMinutes <= CLOSE_HOUR * 60;
}

/** Throws ValidationError (400) when the booking breaks a time rule. */
function validateBookingTimes(start, end) {
  if (!(start.toMillis() < end.toMillis())) {
    throw new ValidationError("startTime must be before endTime");
  }
  const minutes = (end.toMillis() - start.toMillis()) / 60000;
  if (minutes < MIN_DURATION_MINUTES) {
    throw new ValidationError("Booking duration must be at least 15 minutes");
  }
  if (minutes > MAX_DURATION_MINUTES) {
    throw new ValidationError("Booking duration must not be more than 4 hours");
  }
  if (!isWithinBusinessHours(start, end)) {
    throw new ValidationError("Bookings are only allowed Monday to Friday, 08:00-20:00 (room local time)");
  }
}

module.exports = {
  overlaps,
  isWithinBusinessHours,
  validateBookingTimes,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  OPEN_HOUR,
  CLOSE_HOUR,
};
