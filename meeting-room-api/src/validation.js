const { ValidationError } = require("./errors");
const { isValidZone, resolveBoundary } = require("./domain/timeUtils");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REPORT_DAYS = 366;

function requireObject(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Request body must be a JSON object");
  }
  return body;
}

function throwIfAny(errors) {
  if (errors.length > 0) throw new ValidationError(errors.join("; "));
}

function parseIntParam(value, name, { min, max } = {}) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) {
    throw new ValidationError(`${name} must be an integer`);
  }
  const n = Number(value);
  if (min !== undefined && n < min) throw new ValidationError(`${name} must be at least ${min}`);
  if (max !== undefined && n > max) throw new ValidationError(`${name} must be at most ${max}`);
  return n;
}

function parseDateParam(value, name, isEnd) {
  if (value === undefined) return undefined;
  const dt = resolveBoundary(value, "UTC", isEnd);
  if (!dt) throw new ValidationError(`${name} must be a valid ISO-8601 date or date-time`);
  return dt;
}

function validateCreateRoom(body, defaultTimezone) {
  requireObject(body);
  const { name, capacity, floor, amenities, timezone } = body;
  const errors = [];

  if (typeof name !== "string" || name.trim() === "" || name.trim().length > 100) {
    errors.push("name must be a non-empty string (max 100 characters)");
  }
  if (!Number.isInteger(capacity) || capacity < 1) errors.push("capacity must be an integer of at least 1");
  if (!Number.isInteger(floor)) errors.push("floor must be an integer");

  let cleanAmenities = [];
  if (amenities !== undefined) {
    if (!Array.isArray(amenities) || amenities.some((a) => typeof a !== "string" || a.trim() === "")) {
      errors.push("amenities must be an array of non-empty strings");
    } else {
      cleanAmenities = [...new Set(amenities.map((a) => a.trim()))];
    }
  }

  let zone = defaultTimezone;
  if (timezone !== undefined) {
    if (!isValidZone(timezone)) errors.push('timezone must be a valid IANA time zone, for example "Asia/Kolkata"');
    else zone = timezone;
  }

  throwIfAny(errors);
  return { name: name.trim(), capacity, floor, amenities: cleanAmenities, timezone: zone };
}

function validateListRoomsQuery(query) {
  const filters = {};
  const minCapacity = parseIntParam(query.minCapacity, "minCapacity", { min: 1 });
  if (minCapacity !== undefined) filters.minCapacity = minCapacity;
  if (query.amenity !== undefined) {
    if (typeof query.amenity !== "string" || query.amenity.trim() === "") {
      throw new ValidationError("amenity must be a non-empty string");
    }
    filters.amenity = query.amenity.trim();
  }
  return filters;
}

function validateCreateBooking(body) {
  requireObject(body);
  const { roomId, title, organizerEmail, startTime, endTime } = body;
  const errors = [];

  const validRoomId = (typeof roomId === "string" && roomId.trim() !== "") || Number.isInteger(roomId);
  if (!validRoomId) errors.push("roomId is required (string or integer)");
  if (typeof title !== "string" || title.trim() === "" || title.trim().length > 200) {
    errors.push("title must be a non-empty string (max 200 characters)");
  }
  if (typeof organizerEmail !== "string" || !EMAIL_RE.test(organizerEmail.trim())) {
    errors.push("organizerEmail must be a valid email address");
  }
  for (const [name, value] of [["startTime", startTime], ["endTime", endTime]]) {
    if (typeof value !== "string" || !resolveBoundary(value, "UTC", false)) {
      errors.push(`${name} must be a valid ISO-8601 date-time`);
    }
  }

  throwIfAny(errors);
  return {
    roomId: String(roomId).trim(),
    title: title.trim(),
    organizerEmail: organizerEmail.trim().toLowerCase(),
    startTime: startTime.trim(),
    endTime: endTime.trim(),
  };
}

function validateIdempotencyKey(header) {
  if (header === undefined) return undefined;
  const key = String(header).trim();
  if (key === "" || key.length > 255) {
    throw new ValidationError("Idempotency-Key must be between 1 and 255 characters");
  }
  return key;
}

function validateListBookingsQuery(query) {
  const filters = {};
  if (query.roomId !== undefined) {
    if (typeof query.roomId !== "string" || query.roomId.trim() === "") {
      throw new ValidationError("roomId must be a non-empty string");
    }
    filters.roomId = query.roomId.trim();
  }

  const from = parseDateParam(query.from, "from", false);
  const to = parseDateParam(query.to, "to", true);
  if (from && to && from.toMillis() >= to.toMillis()) throw new ValidationError("from must be before to");
  if (from) filters.from = from.toJSDate();
  if (to) filters.to = to.toJSDate();

  filters.limit = parseIntParam(query.limit, "limit", { min: 1, max: 100 }) ?? 20;
  filters.offset = parseIntParam(query.offset, "offset", { min: 0 }) ?? 0;
  return filters;
}

function validateReportQuery(query) {
  const errors = [];
  if (query.from === undefined) errors.push("from is required");
  if (query.to === undefined) errors.push("to is required");
  throwIfAny(errors);

  const from = parseDateParam(query.from, "from", false);
  const to = parseDateParam(query.to, "to", true);
  if (from.toMillis() >= to.toMillis()) throw new ValidationError("from must be before to");
  if ((to.toMillis() - from.toMillis()) / 86400000 > MAX_REPORT_DAYS) {
    throw new ValidationError(`The report range must not be longer than ${MAX_REPORT_DAYS} days`);
  }
  return { from: query.from.trim(), to: query.to.trim() };
}

module.exports = {
  validateCreateRoom,
  validateListRoomsQuery,
  validateCreateBooking,
  validateIdempotencyKey,
  validateListBookingsQuery,
  validateReportQuery,
};
