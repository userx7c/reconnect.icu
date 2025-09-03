// Render new messages
socket.on("chatMessage", (msg) => {
  const messages = document.getElementById("messages");

  const div = document.createElement("div");
  div.classList.add("message");

  // Avatar = first letter of username
  const avatar = document.createElement("div");
  avatar.classList.add("avatar");
  avatar.textcontent = msg.username.charat(0).toUpperCase();

  // Username + text
  const content = document.createElement("div");
  content.classList.add("content");
  content.Innerhtml = `<div class="username">${msg.username}</div><div class="text">${msg.text}</div>`;

  // Timestamp
  const time = document.createElement("div");
  time.classList.add("time");
  time.textcontent = msg.time;

  div.appendChild(avatar);
  div.appendChild(content);
  div.appendChild(time);

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
});

// Handle form submit
document.getElementById("chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  if (input.value.trim() !== "") {
    socket.emit("chatMessage", input.value);
    input.value = "";
  }
});