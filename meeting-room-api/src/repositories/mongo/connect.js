const mongoose = require("mongoose");
const { Room, Booking, IdempotencyKey } = require("./models");

async function connectMongo(uri) {
  await mongoose.connect(uri);
  // Make sure the unique indexes exist before the first request is served.
  await Promise.all([Room.init(), Booking.init(), IdempotencyKey.init()]);
}

module.exports = { connectMongo };
