const { RoomService } = require("./services/roomService");
const { BookingService } = require("./services/bookingService");
const { ReportService } = require("./services/reportService");

/** Wires services to whichever repositories are passed in (Mongo in production, in-memory in tests). */
function buildServices({ roomRepo, bookingRepo, idempotencyRepo, config, now }) {
  return {
    roomService: new RoomService({ roomRepo, defaultTimezone: config.defaultTimezone }),
    bookingService: new BookingService({ roomRepo, bookingRepo, idempotencyRepo, idempotency: config.idempotency, now }),
    reportService: new ReportService({ roomRepo, bookingRepo }),
  };
}

module.exports = { buildServices };
