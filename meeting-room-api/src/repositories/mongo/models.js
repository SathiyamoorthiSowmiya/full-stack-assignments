const mongoose = require("mongoose");
const { Schema } = mongoose;

const roomSchema = new Schema(
  {
    name: { type: String, required: true },
    // Lower-cased copy of the name; the unique index on it gives case-insensitive uniqueness.
    nameLower: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
    floor: { type: Number, required: true },
    amenities: { type: [String], default: [] },
    timezone: { type: String, required: true },
  },
  { versionKey: false }
);

const bookingSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    organizerEmail: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed" },
    idempotencyKey: { type: String, default: null },
    createdAt: { type: Date, required: true },
    cancelledAt: { type: Date, default: null },
  },
  { versionKey: false }
);
bookingSchema.index({ roomId: 1, status: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ organizerEmail: 1, idempotencyKey: 1 });

const idempotencySchema = new Schema(
  {
    organizerEmail: { type: String, required: true },
    key: { type: String, required: true },
    requestHash: { type: String, required: true },
    status: { type: String, enum: ["in_progress", "completed"], required: true },
    bookingId: { type: Schema.Types.ObjectId, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false }
);
// The unique constraint on (organizer, key) is what makes concurrent duplicates safe.
idempotencySchema.index({ organizerEmail: 1, key: 1 }, { unique: true });

module.exports = {
  Room: mongoose.models.Room || mongoose.model("Room", roomSchema),
  Booking: mongoose.models.Booking || mongoose.model("Booking", bookingSchema),
  IdempotencyKey: mongoose.models.IdempotencyKey || mongoose.model("IdempotencyKey", idempotencySchema),
};
