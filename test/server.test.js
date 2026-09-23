const assert = require("node:assert/strict");
const test = require("node:test");
const { io: connect } = require("socket.io-client");
const { httpServer, io, roomStore } = require("../server/index");

let baseUrl;

function event(socket, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 2000);
    socket.once(name, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

test.before(async () => {
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => io.close(resolve));
});

test.afterEach(() => {
  roomStore.rooms.clear();
  roomStore.socketRooms.clear();
});

test("creates and joins a room, then relays only to the other peer", async () => {
  const host = connect(baseUrl);
  const connector = connect(baseUrl);
  await Promise.all([event(host, "connect"), event(connector, "connect")]);

  host.emit("create-room");
  const { roomCode } = await event(host, "room-created");
  const joined = event(connector, "room-joined");
  const hostNotice = event(host, "connector-joined");
  connector.emit("join-room", { roomCode });
  await joined;
  await hostNotice;

  const signal = event(host, "signal");
  connector.emit("signal", { roomCode, type: "offer", data: { test: true } });
  assert.deepEqual(await signal, { type: "offer", data: { test: true } });

  host.disconnect();
  connector.disconnect();
});

test("rejects a second connector and removes disconnected peers", async () => {
  const host = connect(baseUrl);
  const first = connect(baseUrl);
  const second = connect(baseUrl);
  await Promise.all([event(host, "connect"), event(first, "connect"), event(second, "connect")]);

  host.emit("create-room");
  const { roomCode } = await event(host, "room-created");
  first.emit("join-room", { roomCode });
  await event(first, "room-joined");
  second.emit("join-room", { roomCode });
  assert.equal((await event(second, "error-message")).message, "Room not found or already has a connector.");

  const left = event(host, "peer-left");
  first.disconnect();
  await left;
  assert.equal(roomStore.getMembership(first.id), undefined);

  host.disconnect();
  second.disconnect();
});
