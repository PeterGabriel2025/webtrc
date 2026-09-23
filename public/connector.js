const socket = io();
const roomCodeInput = document.querySelector("#room-code-input");
const joinRoomButton = document.querySelector("#join-room");
const sharingPanel = document.querySelector("#sharing-panel");
const status = document.querySelector("#status");
const errorMessage = document.querySelector("#error");

joinRoomButton.addEventListener("click", () => {
  errorMessage.textContent = "";
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  socket.emit("join-room", { roomCode });
});

socket.on("room-joined", () => {
  roomCodeInput.disabled = true;
  joinRoomButton.disabled = true;
  sharingPanel.hidden = false;
  status.textContent = "Joined. Ready to share.";
});

socket.on("error-message", ({ message }) => {
  errorMessage.textContent = message;
});

socket.on("peer-left", () => {
  status.textContent = "Host left the room.";
});
