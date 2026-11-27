const toBookingResponse = (b) => ({
  id: b.id,
  roomId: b.roomId,
  title: b.title,
  organizerEmail: b.organizerEmail,
  startTime: b.startTime.toISOString(),
  endTime: b.endTime.toISOString(),
  status: b.status,
  createdAt: b.createdAt.toISOString(),
  cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
});

const toRoomResponse = (r) => ({
  id: r.id,
  name: r.name,
  capacity: r.capacity,
  floor: r.floor,
  amenities: r.amenities,
  timezone: r.timezone,
});

module.exports = { toBookingResponse, toRoomResponse };
