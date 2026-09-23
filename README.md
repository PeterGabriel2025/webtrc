# RemoteScreen MVP — Step 1

This is the first small working slice of RemoteScreen:

- A Node.js server with Socket.IO room signaling.
- A simple Host web page.
- One Host and one Connector per room.
- In-memory room state only.

WebRTC media, Android, MediaProjection, microphone capture, TURN, authentication, and deployment are intentionally not included yet.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser and select **Create Room**.

Optional configuration can be copied from `.env.example` to `.env`:

- `PORT`: server port, default `3000`
- `CORS_ORIGIN`: allowed web origin
- `ROOM_CODE_LENGTH`: room code length, default `6`

## Tests

```bash
npm test
```

## Current Socket.IO events

Host:

```js
socket.emit("create-room");
socket.on("room-created", ({ roomCode }) => console.log(roomCode));
```

Connector testing client:

```js
socket.emit("join-room", { roomCode: "ABC234" });
socket.on("room-joined", console.log);
```

The server also emits `connector-joined`, `peer-left`, `error-message`, and `signal`.
`signal` is ready for the later WebRTC step but currently carries no media and does not store payloads.
