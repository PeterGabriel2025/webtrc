# RemoteScreen MVP — Step 1

This is the browser WebRTC MVP slice of RemoteScreen:

- A Node.js server with Socket.IO room signaling.
- A simple Host web page.
- A simple Connector web page.
- One Host and one Connector per room.
- In-memory room state only.
- One-way browser media: Connector screen and microphone to Host.

Android, MediaProjection, TURN, authentication, and deployment hardening are intentionally not included yet.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser and select **Create Room**.

For the Connector browser test, open [http://localhost:3000/connector.html](http://localhost:3000/connector.html), enter the Host's room code, select **Join Room**, then select **Start Sharing**. Approve the browser's screen and microphone prompts. The Host receives both tracks. **Stop Sharing** stops the local tracks and closes the peer connection.

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
`signal` carries SDP/ICE metadata only; media travels directly over WebRTC and is not stored by the server.

For public HTTPS hosting, browser screen capture requires the Render HTTPS URL (or localhost during local development).
