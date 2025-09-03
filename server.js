import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import session from "express-session";
import TelegramBot from "node-telegram-bot-api";

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
    RESAVE: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  })
);

/* -------------------- KEYS -------------------- */
const KEYS_FILE = "./keys.json";

function loadKeys() {
  if (!fs.existsSync(KEYS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function saveKeys(keys) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}
function generateKey() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/* -------------------- VERIFY LOGIN -------------------- */
app.post("/verify", (req, res) => {
  const { key, username } = req.body;
  const keys = loadKeys();

  if (keys[key] && keys[key].used === false) {
    // ✅ mark key as used
    keys[key].used = true;
    if (username) keys[key].user = username;
    saveKeys(keys);

    // ✅ store in session
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
    return res.json({ loggedin: true, user: req.session.user });
  }
  return res.json({ loggedin: false });
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

  socket.on("message", (text) => {
    const clean = (text || "").toString().slice(0, 2000);
    if (!clean.trim()) return;

    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      user: socket.data.username || "User",
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

/* -------------------- ANNOUNCEMENTS -------------------- */
let latestAnnouncement = "";
app.get("/announcement", (req, res) => {
  res.json({ text: latestAnnouncement });
});
function setAnnouncement(text) {
  latestAnnouncement = text;
  io.emit("announcement", text);
}

/* -------------------- TELEGRAM BOT -------------------- */
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const info = `
👋 Hello *${msg.from.first_name}!*

📌 *Your Telegram Info*
━━━━━━━━━━━━━━
🆔 ID: \`${msg.from.id}\`
👤 Username: @${msg.from.username || "N/A"}
📛 Name: ${msg.from.first_name} ${msg.from.last_name || ""}

Press the button below to generate your 1-time login key.
`;

  bot.sendMessage(chatId, info, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "🔑 Generate Key", callback_data: "generate_key" }]],
    },
  });
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  if (query.data === "generate_key") {
    const keys = loadKeys();
    const key = generateKey();
    keys[key] = {
      user: query.from.username || query.from.first_name,
      used: false,
    };
    saveKeys(keys);

    bot.sendMessage(
      chatId,
      `✅ Here is your 1-time key:\n\`\`\`\n${key}\n\`\`\`\nUse it on the website to login.`,
      { parse_mode: "Markdown" }
    );
  }
});

bot.onText(/\/announce (.+)/, (msg, match) => {
  const chatId = msg.chat.id.toString();
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  if (chatId === adminId) {
    const announcement = match[1];
    bot.sendMessage(chatId, `📢 Announcement sent:\n${announcement}`);
    setAnnouncement(announcement);
  } else {
    bot.sendMessage(chatId, "❌ You are not authorized to send announcements.");
  }
});

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server + Socket.IO running: http://localhost:${PORT}`);
});

