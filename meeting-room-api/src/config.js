require("dotenv").config();

const num = (value, fallback) => (value === undefined || value === "" ? fallback : Number(value));

module.exports = {
  port: num(process.env.PORT, 3000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/meeting-rooms",
  defaultTimezone: process.env.DEFAULT_TIMEZONE || "UTC",
  idempotency: {
    waitMs: 5000,   // how long a duplicate request waits for the first one to finish
    pollMs: 25,     // how often it checks
    staleMs: 30000, // an "in progress" key older than this is treated as a crashed request
  },
};
