const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const RoomStore = require("./roomStore");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const port = Number.parseInt(process.env.PORT || "3000", 10);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const roomCodeLength = Number.parseInt(process.env.ROOM_CODE_LENGTH || "6", 10);
const publicDirectory = path.resolve(__dirname, "../public");
const roomStore = new RoomStore();

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(roomCodeLength);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function sendError(socket, message) {
  socket.emit("error-message", { message });
}

function otherPeer(io, socketId, event, data) {
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
}

function createHttpServer() {
  return http.createServer((request, response) => {
    const requestedPath = request.url === "/" ? "/index.html" : request.url;
    const filePath = path.resolve(publicDirectory, `.${requestedPath}`);

    if (!filePath.startsWith(publicDirectory)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const contentTypes = {
        ".css": "text/css",
        ".html": "text/html",
        ".js": "text/javascript"
      };
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "text/plain"
      });
      response.end(content);
    });
  });
}

const httpServer = createHttpServer();
const io = new Server(httpServer, { cors: { origin: corsOrigin } });

io.on("connection", (socket) => {
  socket.on("create-room", () => {
    if (roomStore.getMembership(socket.id)) {
      sendError(socket, "You are already in a room.");
      return;
    }

    let roomCode;
    do {
      roomCode = createRoomCode();
    } while (!roomStore.create(roomCode, socket.id));

    socket.join(roomCode);
    console.log(`Room ${roomCode} created`);
    socket.emit("room-created", { roomCode });
  });

  socket.on("join-room", ({ roomCode } = {}) => {
    if (typeof roomCode !== "string" || !/^[A-Z0-9]{6}$/.test(roomCode)) {
      sendError(socket, "Enter a valid room code.");
      return;
    }
    if (roomStore.getMembership(socket.id)) {
      sendError(socket, "You are already in a room.");
      return;
    }
    if (!roomStore.join(roomCode, socket.id)) {
      sendError(socket, "Room not found or already has a connector.");
      return;
    }

    socket.join(roomCode);
    const room = roomStore.getRoom(roomCode);
    socket.emit("room-joined", { roomCode });
    otherPeer(io, room.host, "connector-joined");
    console.log(`Connector joined room ${roomCode}`);
  });

  socket.on("signal", ({ roomCode, type, data } = {}) => {
    const membership = roomStore.getMembership(socket.id);
    if (!membership || membership.roomCode !== roomCode) {
      sendError(socket, "You are not a member of this room.");
      return;
    }

    const room = roomStore.getRoom(roomCode);
    const recipient = membership.role === "host" ? room.connector : room.host;
    otherPeer(io, recipient, "signal", { type, data });
  });

  socket.on("disconnect", () => {
    const removed = roomStore.remove(socket.id);
    if (!removed) {
      return;
    }

    otherPeer(io, removed.otherSocketId, "peer-left");
    console.log(`Peer left room ${removed.roomCode}`);
  });
});

if (require.main === module) {
  httpServer.listen(port, () => {
    console.log(`RemoteScreen server running at http://localhost:${port}`);
  });
}

module.exports = { httpServer, io, roomStore };
