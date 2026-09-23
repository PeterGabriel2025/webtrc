const socket = io();
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const roomCodeInput = document.querySelector("#room-code-input");
const joinRoomButton = document.querySelector("#join-room");
const sharingPanel = document.querySelector("#sharing-panel");
const status = document.querySelector("#status");
const errorMessage = document.querySelector("#error");
const startSharingButton = document.querySelector("#start-sharing");
const stopSharingButton = document.querySelector("#stop-sharing");
let peerConnection;
let localStream;
let joinedRoomCode;

joinRoomButton.addEventListener("click", () => {
  errorMessage.textContent = "";
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  socket.emit("join-room", { roomCode });
});

socket.on("room-joined", () => {
  joinedRoomCode = roomCodeInput.value.trim().toUpperCase();
  roomCodeInput.disabled = true;
  joinRoomButton.disabled = true;
  sharingPanel.hidden = false;
  status.textContent = "Joined. Ready to share.";
});

startSharingButton.addEventListener("click", async () => {
  errorMessage.textContent = "";
  startSharingButton.disabled = true;

  try {
    if (!window.isSecureContext) {
      throw new Error("Screen sharing requires HTTPS or localhost.");
    }

    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });
    const microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
    localStream = new MediaStream([
      ...screenStream.getVideoTracks(),
      ...microphoneStream.getAudioTracks()
    ]);
    peerConnection = createPeerConnection();
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }

    screenStream.getVideoTracks()[0].addEventListener("ended", stopSharing);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    sendSignal("offer", peerConnection.localDescription);
    status.textContent = "Sharing screen and microphone.";
    stopSharingButton.disabled = false;
  } catch (error) {
    stopLocalTracks();
    startSharingButton.disabled = false;
    showError(`Sharing could not start: ${error.message}`);
  }
});

stopSharingButton.addEventListener("click", stopSharing);

socket.on("signal", async ({ type, data }) => {
  try {
    if (type === "answer" && peerConnection) {
      await peerConnection.setRemoteDescription(data);
      return;
    }
    if (type === "ice-candidate" && peerConnection) {
      await peerConnection.addIceCandidate(data);
    }
  } catch (error) {
    showError(`WebRTC error: ${error.message}`);
  }
});

socket.on("error-message", ({ message }) => {
  showError(message);
});

socket.on("peer-left", () => {
  stopSharing(false);
  status.textContent = "Host left the room.";
});

function createPeerConnection() {
  const connection = new RTCPeerConnection({ iceServers });
  connection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      sendSignal("ice-candidate", candidate);
    }
  };
  connection.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(connection.connectionState)) {
      status.textContent = "Connection ended.";
    }
  };
  return connection;
}

function sendSignal(type, data) {
  socket.emit("signal", { roomCode: joinedRoomCode, type, data });
}

function stopSharing(notifyHost = true) {
  stopLocalTracks();
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (notifyHost && joinedRoomCode) {
    sendSignal("stop", {});
  }
  startSharingButton.disabled = false;
  stopSharingButton.disabled = true;
  status.textContent = "Sharing stopped.";
}

function stopLocalTracks() {
  if (localStream) {
    for (const track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;
  }
}

function showError(message) {
  errorMessage.textContent = message;
}
