// test-telegram.js
import fetch from "node-fetch";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const message = "✅ Test message from my Node.js bot!";

async function sendMessage() {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    const data = await res.json();
    console.log("Telegram response:", data);
  } catch (err) {
    console.error("Error sending message:", err);
  }
}

sendMessage();
