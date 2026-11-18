const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const http = require("http");
const PocketOptionClient = require("./pocket_client");
const { parseSignal } = require("./parser");
require("dotenv").config();

// Configuration
const API_ID = parseInt(process.env.TELEGRAM_API_ID, 10);
const API_HASH = process.env.TELEGRAM_API_HASH;
const SESSION_STRING = process.env.TELEGRAM_SESSION;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID || "2684722871";

const POCKET_SESSION_TOKEN = process.env.POCKET_SESSION_TOKEN;
const POCKET_UID = process.env.POCKET_UID;
const IS_DEMO = process.env.IS_DEMO !== "false"; // Default to DEMO
const TRADE_AMOUNT = parseFloat(process.env.TRADE_AMOUNT || "10");
const MIN_BALANCE_FLOOR = parseFloat(process.env.MIN_BALANCE_FLOOR || "30");

console.log("==================================================");
console.log("   AUTOMATED SIGNAL COPIER FOR RAI FAIR TRADER    ");
console.log("==================================================");
console.log(`• Mode:               ${IS_DEMO ? "🟢 DEMO ACCOUNT" : "🔴 REAL ACCOUNT"}`);
console.log(`• Pocket Option UID:  ${POCKET_UID}`);
console.log(`• Fixed Trade Amount: $${TRADE_AMOUNT}`);
console.log(`• Safety Floor:       $${MIN_BALANCE_FLOOR}`);
console.log(`• Target Channel:     ${TARGET_CHANNEL_ID}`);
console.log("==================================================\n");

if (!SESSION_STRING) {
  console.error("❌ ERROR: TELEGRAM_SESSION is missing!");
  console.error("Please run: node auth_telegram.js first to generate your session string.\n");
  process.exit(1);
}

if (!POCKET_SESSION_TOKEN || !POCKET_UID) {
  console.error("❌ ERROR: POCKET_SESSION_TOKEN or POCKET_UID is missing in .env!");
  process.exit(1);
}

// 1. Initialize Pocket Option Client
const pocket = new PocketOptionClient({
  sessionToken: POCKET_SESSION_TOKEN,
  uid: POCKET_UID,
  isDemo: IS_DEMO ? 1 : 0
});

// 2. HTTP Server with Live Health Check & Instant Test-Trade Trigger
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  if (req.url === '/test-trade') {
    try {
      console.log("\n[Test Trigger] Manual test trade requested via web URL!");
      pocket.openOrder({
        asset: "AUDUSD_otc",
        amount: TRADE_AMOUNT,
        action: "call",
        time: 60
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: "SUCCESS",
        message: "Test trade successfully sent to Pocket Option Demo! Check your Pocket Option open trades window.",
        details: {
          asset: "AUDUSD_otc",
          action: "CALL / HIGHER",
          amount: "$" + TRADE_AMOUNT,
          duration: "60 seconds",
          mode: "DEMO"
        }
      }, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: "ERROR", error: err.message }, null, 2));
    }
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(
    "Pocket Option Telegram Bot is Online and Listening 24/7\n\n" +
    "To test a trade on your Demo account right now, visit:\n" +
    "https://pocket-signal-bot-dp4q.onrender.com/test-trade\n"
  );
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Server] Health check listening on port ${PORT}`);
});

// 2. Initialize Telegram MTProto Client
const stringSession = new StringSession(SESSION_STRING);
const telegram = new TelegramClient(stringSession, API_ID, API_HASH, {
  connectionRetries: 10,
});

async function start() {
  try {
    // Connect to Pocket Option
    await pocket.connect();

    // Connect to Telegram
    console.log("[Telegram] Connecting to Telegram...");
    await telegram.connect();
    console.log("[Telegram] ✅ Connected successfully!");

    const me = await telegram.getMe();
    console.log(`[Telegram] Logged in as: ${me.firstName} (@${me.username || me.phone})`);
    console.log("[System] 👂 Now listening 24/7 for trade signals...\n");

    // Listen for new messages
    telegram.addEventHandler(async (event) => {
      const message = event.message;
      if (!message || !message.text) return;

      // Filter specifically for Rai Fair Trader channel
      const chatId = message.chatId ? message.chatId.toString() : '';
      if (TARGET_CHANNEL_ID && !chatId.includes('2684722871') && chatId !== TARGET_CHANNEL_ID) {
        return;
      }

      // Check if message contains SIGNAL
      if (!message.text.includes("SIGNAL")) return;

      const dateNow = Math.floor(Date.now() / 1000);
      const msgDate = message.date; // unix timestamp

      console.log(`\n--------------------------------------------------`);
      console.log(`[Signal Detected] Time: ${new Date().toISOString()}`);
      console.log(message.text);

      // Guard: Do not execute stale signals older than 60 seconds
      if (dateNow - msgDate > 60) {
        console.warn(`⚠️ IGNORED: Signal is stale (Received ${dateNow - msgDate}s after broadcast).`);
        return;
      }

      // Parse Signal
      const parsed = parseSignal(message.text);
      if (!parsed) {
        console.warn("⚠️ Could not parse trade parameters from message.");
        return;
      }

      console.log(`[Parsed Trade] Asset: ${parsed.pocketAsset} | Expiry: ${parsed.minutes}m (${parsed.durationSeconds}s) | Action: ${parsed.action.toUpperCase()}`);

      // Safety Guard: Check account balance floor
      if (pocket.balance !== null && pocket.balance < MIN_BALANCE_FLOOR) {
        console.error(`🛑 HALT: Account balance ($${pocket.balance}) is below safety floor ($${MIN_BALANCE_FLOOR}). Order cancelled.`);
        return;
      }

      // Execute Trade
      try {
        pocket.openOrder({
          asset: parsed.pocketAsset,
          amount: TRADE_AMOUNT,
          action: parsed.action,
          time: parsed.durationSeconds
        });
      } catch (err) {
        console.error("❌ Failed to place trade on Pocket Option:", err.message);
      }
    }, new NewMessage({}));

  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

start();
