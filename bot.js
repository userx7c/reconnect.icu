import fs from "fs";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { setAnnouncement } from "./server.js"; // ✅ correct import

dotenv.config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const KEYS_FILE = "./keys.json";

/* -------------------- LOAD KEYS -------------------- */
let keys = {};
if (fs.existsSync(KEYS_FILE)) {
  keys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
}

function saveKeys() {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

function generateKey() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/* -------------------- IO HOOK -------------------- */
let ioInstance;
export function setIo(io) {
  ioInstance = io;
}

/* -------------------- BOT HANDLERS -------------------- */

// /start command → show info + key button
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
      inline_keyboard: [
        [{ text: "🔑 Generate Key", callback_data: "generate_key" }]
      ],
    },
  });
});

// Handle "Generate Key" button
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "generate_key") {
    const key = generateKey();
    keys[key] = {
      user: query.from.username || query.from.first_name,
      used: false,
    };
    saveKeys();

    bot.sendMessage(
      chatId,
      `✅ Here is your 1-time key:\n\`\`\`\n${key}\n\`\`\`\nUse it on the website to login.`,
      { parse_mode: "Markdown" }
    );
  }
});

// /announce command → only admin can send
bot.onText(/\/announce (.+)/, (msg, match) => {
  const chatId = msg.chat.id.toString();
  const adminId = process.env.TELEGRAM_ADMIN_ID;

  if (chatId === adminId) {
    const announcement = match[1];
    bot.sendMessage(chatId, `📢 Announcement sent:\n${announcement}`);

    // Persist + broadcast
    setAnnouncement(announcement);
  } else {
    bot.sendMessage(chatId, "❌ You are not authorized to send announcements.");
  }
});

export { bot, keys, saveKeys };
