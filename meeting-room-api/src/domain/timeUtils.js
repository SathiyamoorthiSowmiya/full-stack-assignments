const { DateTime } = require("luxon");

function isValidZone(zone) {
  return typeof zone === "string" && zone !== "" && DateTime.now().setZone(zone).isValid;
}

/**
 * Parses an ISO-8601 string. If the string has no offset ("2030-01-07T10:00:00")
 * it is read as local time in `zone`. If it has one ("...Z", "+05:30") that wins.
 * The result is expressed in `zone`. Returns null if the input is not valid ISO-8601.
 */
function parseInstant(value, zone = "UTC") {
  if (typeof value !== "string") return null;
  const dt = DateTime.fromISO(value.trim(), { zone });
  return dt.isValid ? dt : null;
}

function isDateOnly(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/**
 * Range boundary for `from` / `to` filters. A date-only `to` ("2030-01-11")
 * means the whole day, so it resolves to the start of the next day.
 */
function resolveBoundary(value, zone, isEnd) {
  const dt = parseInstant(value, zone);
  if (!dt) return null;
  return isEnd && isDateOnly(value) ? dt.plus({ days: 1 }) : dt;
}

module.exports = { isValidZone, parseInstant, isDateOnly, resolveBoundary };
