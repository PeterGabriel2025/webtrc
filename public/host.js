const socket = io();
let iceServers = [];

const createRoomButton = document.querySelector("#create-room");
const roomPanel = document.querySelector("#room-panel");
const roomCode = document.querySelector("#room-code");
const status = document.querySelector("#status");
const errorMessage = document.querySelector("#error");
const remoteVideo = document.querySelector("#remote-video");
const mediaStatus = document.querySelector("#media-status");

let peerConnection;
let pendingIceCandidates = [];

async function loadIceServers() {
  const response = await fetch(
    "/api/turn-credential",
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `TURN configuration failed: ${response.status} ${body}`
    );
  }

  const data = await response.json();

  if (!Array.isArray(data.iceServers)) {
    throw new Error(
      "Invalid TURN configuration."
    );
  }

  iceServers = data.iceServers;
}

createRoomButton.addEventListener("click", () => {
  errorMessage.textContent = "";
  createRoomButton.disabled = true;
  socket.emit("create-room");
});

socket.on("room-created", ({ roomCode: createdRoomCode }) => {
  roomCode.textContent = createdRoomCode;
  roomPanel.hidden = false;
});

socket.on("connector-joined", () => {
  status.textContent = "Connector joined. Waiting for sharing...";
});

socket.on("signal", async ({ type, data }) => {
  try {
    if (type === "offer") {
      await loadIceServers();

      peerConnection = createPeerConnection();

      await peerConnection.setRemoteDescription(data);

      for (const candidate of pendingIceCandidates) {
        await peerConnection.addIceCandidate(candidate);
      }

      pendingIceCandidates = [];

      const answer = await peerConnection.createAnswer();

      await peerConnection.setLocalDescription(answer);

      sendSignal(
        "answer",
        peerConnection.localDescription
      );

      return;
    }

    if (type === "ice-candidate") {
      if (!peerConnection || !peerConnection.remoteDescription) {
        pendingIceCandidates.push(data);
        return;
      }

      await peerConnection.addIceCandidate(data);
      return;
    }

    if (type === "stop") {
      closePeerConnection();
      status.textContent = "Sharing stopped.";
      mediaStatus.textContent = "No sharing active.";
    }

  } catch (error) {
    showError(
      `WebRTC error: ${error.message}`
    );
  }
});

socket.on("peer-left", () => {
  closePeerConnection();

  status.textContent = "Connector left.";
  mediaStatus.textContent = "No sharing active.";
});

socket.on("error-message", ({ message }) => {
  showError(message);
  createRoomButton.disabled = false;
});

function createPeerConnection() {
  const connection =
    new RTCPeerConnection({
      iceServers
    });

  connection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      sendSignal(
        "ice-candidate",
        candidate
      );
    }
  };

  connection.ontrack = ({ streams }) => {
    if (streams[0]) {
      remoteVideo.srcObject = streams[0];

      mediaStatus.textContent =
        "Receiving screen and microphone.";

      status.textContent = "Connected";
    }
  };

  connection.onconnectionstatechange = () => {
    if (
      [
        "failed",
        "disconnected",
        "closed"
      ].includes(
        connection.connectionState
      )
    ) {
      mediaStatus.textContent =
        "Connection ended.";
    }
  };

  return connection;
}

function sendSignal(type, data) {
  socket.emit(
    "signal",
    {
      roomCode: roomCode.textContent,
      type,
      data
    }
  );
}

function closePeerConnection() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  pendingIceCandidates = [];

  remoteVideo.srcObject = null;
}

function showError(message) {
  errorMessage.textContent = message;
}