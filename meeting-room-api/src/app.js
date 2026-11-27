const express = require("express");
const { roomController } = require("./controllers/roomController");
const { bookingController } = require("./controllers/bookingController");
const { reportController } = require("./controllers/reportController");
const { asyncHandler, notFoundHandler, errorHandler } = require("./middleware/errorHandler");

/** Routing only: map URLs to controllers. No business logic lives here. */
function createApp({ roomService, bookingService, reportService }) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  const rooms = roomController(roomService);
  const bookings = bookingController(bookingService);
  const reports = reportController(reportService);

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.post("/rooms", asyncHandler(rooms.create));
  app.get("/rooms", asyncHandler(rooms.list));

  app.post("/bookings", asyncHandler(bookings.create));
  app.get("/bookings", asyncHandler(bookings.list));
  app.post("/bookings/:id/cancel", asyncHandler(bookings.cancel));

  app.get("/reports/room-utilization", asyncHandler(reports.roomUtilization));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
