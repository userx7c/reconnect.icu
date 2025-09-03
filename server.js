import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import session from "express-session";
import { bot, setIo } from "./bot.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

// session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

/* -------------------- KEYS -------------------- */
const KEYS_FILE = "./keys.json";

function loadKeys() {
  if (!fs.existsSync(KEYS_FILE)) return {};
  return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
}
function saveKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

/* -------------------- VERIFY LOGIN -------------------- */
app.post("/verify", (req, res) => {
  const { key, username } = req.body;
  const keys = loadKeys();

  if (keys[key] && keys[key].used === false) {
    keys[key].used = true;
    saveKeys(keys);

    // store session
    req.session.user = {
      username: username || keys[key].user || "User",
    };

    return res.json({ success: true, username: req.session.user.username });
  }
  return res.status(400).json({ success: false, message: "Invalid key" });
});

/* -------------------- SESSION CHECK -------------------- */
app.get("/session", (req, res) => {
  if (req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
});

/* -------------------- CHAT -------------------- */
const MESSAGES_MAX = 200;
const messages = [];

io.on("connection", (socket) => {
  console.log("🟢 User connected");

  socket.on("join", ({ username }) => {
    socket.data.username = username || "User";
    socket.emit("init", messages);
  });

socket.on("message", (data) => {
  const clean = (data.text || "").toString().slice(0, 2000);
  if (!clean.trim()) return;

  const msg = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    user: data.user || socket.data.username || "User",
    text: clean,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  messages.push(msg);
  if (messages.length > MESSAGES_MAX) messages.shift();

  io.emit("message", msg);
});


  socket.on("disconnect", () => {
    console.log("🔴 User disconnected");
  });
});

/* -------------------- CONNECT BOT TO IO -------------------- */
setIo(io);

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server + Socket.IO running: http://localhost:${PORT}`);
});


/* -------------------- ANNOUNCEMENTS -------------------- */
const ANNOUNCEMENTS_FILE = "./announcements.json";
let latestAnnouncement = "";

// Load latest announcement on server start
if (fs.existsSync(ANNOUNCEMENTS_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(ANNOUNCEMENTS_FILE, "utf-8"));
    latestAnnouncement = data.latest || "";
  } catch (err) {
    console.error("Failed to load announcements:", err);
  }
}

// Expose latest announcement
app.get("/announcement", (req, res) => {
  res.json({ text: latestAnnouncement });
});

export function SatanNouncement(text) {
  latestAnnouncement = text;
  io.emit("announcement", text);
}
// Save announcement to file
function saveAnnouncement(text) {
  fs.writeFileSync(
    ANNOUNCEMENTS_FILE,
    JSON.stringify({ latest: text }, null, 2)
  );
}

// Function bot.js calls when /announce is used
export function setAnnouncement(text) {
  latestAnnouncement = text;

  // Save to disk
  saveAnnouncement(text);

  // Broadcast to all clients
  io.emit("announcement", text);
}

