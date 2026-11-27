const config = require("./config");
const { connectMongo } = require("./repositories/mongo/connect");
const { MongoRoomRepository } = require("./repositories/mongo/roomRepository");
const { MongoBookingRepository } = require("./repositories/mongo/bookingRepository");
const { MongoIdempotencyRepository } = require("./repositories/mongo/idempotencyRepository");
const { buildServices } = require("./container");
const { createApp } = require("./app");

async function main() {
  await connectMongo(config.mongoUri);

  const services = buildServices({
    roomRepo: new MongoRoomRepository(),
    bookingRepo: new MongoBookingRepository(),
    idempotencyRepo: new MongoIdempotencyRepository(),
    config,
  });

  createApp(services).listen(config.port, () => {
    console.log(`Meeting Room API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
