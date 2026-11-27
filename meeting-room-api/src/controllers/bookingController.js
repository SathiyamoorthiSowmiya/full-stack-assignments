const { toBookingResponse } = require("../presenters");
const { validateIdempotencyKey } = require("../validation");

function bookingController(bookingService) {
  return {
    async create(req, res) {
      const key = validateIdempotencyKey(req.get("Idempotency-Key"));
      const { booking, replayed } = await bookingService.createBooking(req.body, key);
      if (replayed) res.set("Idempotent-Replayed", "true");
      res.status(201).json(toBookingResponse(booking));
    },
    async list(req, res) {
      const result = await bookingService.listBookings(req.query);
      res.json({ ...result, items: result.items.map(toBookingResponse) });
    },
    async cancel(req, res) {
      const booking = await bookingService.cancelBooking(req.params.id);
      res.json(toBookingResponse(booking));
    },
  };
}

module.exports = { bookingController };
