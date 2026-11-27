const { randomUUID } = require("crypto");
const { ConflictError } = require("../../errors");

class MemoryRoomRepository {
  constructor() {
    this.rooms = new Map();
  }

  async create(room) {
    const lower = room.name.toLowerCase();
    for (const existing of this.rooms.values()) {
      if (existing.name.toLowerCase() === lower) {
        throw new ConflictError(`A room named "${room.name}" already exists`);
      }
    }
    const saved = { ...room, id: randomUUID() };
    this.rooms.set(saved.id, saved);
    return { ...saved };
  }

  async findById(id) {
    const room = this.rooms.get(id);
    return room ? { ...room } : null;
  }

  async list({ minCapacity, amenity } = {}) {
    const wanted = amenity ? amenity.toLowerCase() : null;
    return [...this.rooms.values()]
      .filter((r) => minCapacity === undefined || r.capacity >= minCapacity)
      .filter((r) => !wanted || r.amenities.some((a) => a.toLowerCase() === wanted))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((r) => ({ ...r }));
  }
}

module.exports = { MemoryRoomRepository };
