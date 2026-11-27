const { resolveBoundary } = require("../domain/timeUtils");
const { computeUtilization } = require("../domain/utilization");
const { validateReportQuery } = require("../validation");

class ReportService {
  constructor({ roomRepo, bookingRepo }) {
    this.roomRepo = roomRepo;
    this.bookingRepo = bookingRepo;
  }

  async roomUtilization(query) {
    const { from, to } = validateReportQuery(query);
    const rooms = await this.roomRepo.list({});

    const rows = [];
    for (const room of rooms) {
      // Each room reads from/to in its own time zone when they carry no offset.
      const rangeStart = resolveBoundary(from, room.timezone, false);
      const rangeEnd = resolveBoundary(to, room.timezone, true);
      const bookings = await this.bookingRepo.findConfirmedOverlapping(
        room.id, rangeStart.toJSDate(), rangeEnd.toJSDate()
      );
      const { totalBookingHours, utilizationPercent } = computeUtilization({
        bookings, rangeStart, rangeEnd, zone: room.timezone,
      });
      rows.push({ roomId: room.id, roomName: room.name, totalBookingHours, utilizationPercent });
    }
    return rows;
  }
}

module.exports = { ReportService };
