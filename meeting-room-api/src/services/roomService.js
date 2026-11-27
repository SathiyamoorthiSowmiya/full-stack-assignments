const { validateCreateRoom, validateListRoomsQuery } = require("../validation");

class RoomService {
  constructor({ roomRepo, defaultTimezone }) {
    this.roomRepo = roomRepo;
    this.defaultTimezone = defaultTimezone;
  }

  async createRoom(body) {
    const data = validateCreateRoom(body, this.defaultTimezone);
    return this.roomRepo.create(data);
  }

  async listRooms(query) {
    return this.roomRepo.list(validateListRoomsQuery(query));
  }
}

module.exports = { RoomService };
