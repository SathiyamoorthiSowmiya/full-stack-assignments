const { toRoomResponse } = require("../presenters");

function roomController(roomService) {
  return {
    async create(req, res) {
      const room = await roomService.createRoom(req.body);
      res.status(201).json(toRoomResponse(room));
    },
    async list(req, res) {
      const rooms = await roomService.listRooms(req.query);
      res.json(rooms.map(toRoomResponse));
    },
  };
}

module.exports = { roomController };
