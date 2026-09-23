const socket = io();
const createRoomButton = document.querySelector("#create-room");
const roomPanel = document.querySelector("#room-panel");
const roomCode = document.querySelector("#room-code");
const status = document.querySelector("#status");
const errorMessage = document.querySelector("#error");

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

socket.on("peer-left", () => {
  status.textContent = "Connector left.";
});

socket.on("error-message", ({ message }) => {
  errorMessage.textContent = message;
  createRoomButton.disabled = false;
});
