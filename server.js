import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(express.static(path.join(__dirname, "public")));

// ------------------- KEYS -------------------
const KEYS_FILE = path.join(__dirname, "keys.json");

function loadKeys() {
  if (!fs.existsSync(KEYS_FILE)) return {};
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
}

function saveKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

// ------------------- VERIFY -------------------
app.post("/verify", (req, res) => {
  const { key, username } = req.body;
  const keys = loadKeys();

  if (keys[key] && keys[key].used === false) {
    keys[key].used = true;
    saveKeys(keys);

    // Store user in session
    req.session.user = { username: username || "User" };

    return res.json({ success: true });
  }
  return res.status(400).json({ success: false, message: "Invalid key" });
});

// ------------------- SESSION -------------------
app.get("/session", (req, res) => {
  if (req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  res.json({ loggedIn: false });
});

// ------------------- PANEL -------------------
app.get("/panel", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "panel.html"));
});

// ------------------- ANNOUNCEMENTS -------------------
let latestAnnouncement = "Welcome to the panel! Stay tuned for updates...";

app.get("/announcement", (req, res) => {
  res.json({ text: latestAnnouncement });
});

app.post("/announce", (req, res) => {
  const { text } = req.body;
  if (text) {
    latestAnnouncement = text;
    io.emit("announcement", text);
    return res.json({ success: true });
  }
  res.status(400).json({ success: false });
});

// ------------------- CHAT -------------------
let chatHistory = [];

io.on("connection", (socket) => {
  console.log("New client connected");

  // Send chat history
  socket.emit("init", chatHistory);

  // Handle join
  socket.on("join", ({ username }) => {
    socket.username = username || "User";
  });

  // Handle message
  socket.on("message", (text) => {
    const msg = {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString(),
    };
    chatHistory.push(msg);
    io.emit("message", msg);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// ------------------- START -------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
