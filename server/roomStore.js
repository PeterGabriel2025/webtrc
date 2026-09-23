class RoomStore {
  constructor() {
    this.rooms = new Map();
    this.socketRooms = new Map();
  }

  create(roomCode, socketId) {
    if (this.rooms.has(roomCode)) {
      return false;
    }

    this.rooms.set(roomCode, { host: socketId, connector: null });
    this.socketRooms.set(socketId, { roomCode, role: "host" });
    return true;
  }

  join(roomCode, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room || room.connector) {
      return false;
    }

    room.connector = socketId;
    this.socketRooms.set(socketId, { roomCode, role: "connector" });
    return true;
  }

  remove(socketId) {
    const membership = this.socketRooms.get(socketId);
    if (!membership) {
      return null;
    }

    const room = this.rooms.get(membership.roomCode);
    this.socketRooms.delete(socketId);
    if (!room) {
      return null;
    }

    if (room.host === socketId) {
      room.host = null;
    }
    if (room.connector === socketId) {
      room.connector = null;
    }

    const otherSocketId = room.host || room.connector;
    if (!room.host && !room.connector) {
      this.rooms.delete(membership.roomCode);
    }

    return { ...membership, otherSocketId };
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  getMembership(socketId) {
    return this.socketRooms.get(socketId);
  }
}

module.exports = RoomStore;
