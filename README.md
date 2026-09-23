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

Open [http://localhost:3000](http://localhost:3000) in a browser. Choose **Create Room** for the Host or **Join Room** for the Connector.

The Host page is available at [http://localhost:3000/host.html](http://localhost:3000/host.html). The Connector page is available at [http://localhost:3000/connector.html](http://localhost:3000/connector.html). The Connector enters the Host's room code, selects **Join Room**, then selects **Start Sharing**. Approve the browser's screen and microphone prompts. The Host receives both tracks. **Stop Sharing** stops the local tracks and closes the peer connection.

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

## Android Connector

The native Android project is in [android-connector](./android-connector). Before building it, replace `YOUR-RENDER-SERVICE` in `app/src/main/res/values/config.xml` with the actual Render service hostname. Open the folder in Android Studio, sync Gradle, connect an Android 14 device, and run the app.

The Android app requests only `INTERNET`, `RECORD_AUDIO`, and the Android 14 foreground-service permissions needed for visible MediaProjection capture. It does not request `CAMERA`. The app always starts capture through Android's system MediaProjection consent dialog.
