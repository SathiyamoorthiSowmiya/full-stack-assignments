const { Room } = require("./models");
const { ConflictError } = require("../../errors");
const { isObjectIdString, escapeRegex, isDuplicateKeyError } = require("./helpers");

const toRoom = (doc) => ({
  id: String(doc._id),
  name: doc.name,
  capacity: doc.capacity,
  floor: doc.floor,
  amenities: doc.amenities || [],
  timezone: doc.timezone,
});

class MongoRoomRepository {
  async create(room) {
    try {
      const doc = await Room.create({ ...room, nameLower: room.name.toLowerCase() });
      return toRoom(doc.toObject());
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new ConflictError(`A room named "${room.name}" already exists`);
      throw err;
    }
  }

  async findById(id) {
    if (!isObjectIdString(id)) return null;
    const doc = await Room.findById(id).lean();
    return doc ? toRoom(doc) : null;
  }

  async list({ minCapacity, amenity } = {}) {
    const filter = {};
    if (minCapacity !== undefined) filter.capacity = { $gte: minCapacity };
    if (amenity) filter.amenities = { $regex: `^${escapeRegex(amenity)}$`, $options: "i" };
    const docs = await Room.find(filter).sort({ nameLower: 1 }).lean();
    return docs.map(toRoom);
  }
}

module.exports = { MongoRoomRepository };
