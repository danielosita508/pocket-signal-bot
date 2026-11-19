const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const http = require("http");
const https = require("https");
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
  const urlObj = new URL(req.url, 'http://localhost');
  if (urlObj.pathname === '/test-trade') {
    (async () => {
      try {
        const tradeAsset = urlObj.searchParams.get('asset') || 'AUDCAD_otc';
        const tradeAction = (urlObj.searchParams.get('action') || 'call').toLowerCase();
        const tradeTime = parseInt(urlObj.searchParams.get('time') || '240', 10);
        const tradeAmount = parseFloat(urlObj.searchParams.get('amount') || '10');

        console.log(`\n[Test Trigger] Manual test trade requested via web URL: ${tradeAsset} ${tradeAction} ${tradeTime}s ($${tradeAmount})`);
        await pocket.openOrder({
          asset: tradeAsset,
          amount: tradeAmount,
          action: tradeAction,
          time: tradeTime
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: "SUCCESS",
          message: `${tradeTime / 60}-Minute Test trade successfully sent to Pocket Option Demo! Check your Pocket Option open trades window right now.`,
          details: {
            asset: tradeAsset,
            action: tradeAction === 'call' ? "CALL / HIGHER" : "PUT / LOWER",
            amount: "$" + tradeAmount,
            duration: `${tradeTime} seconds (${tradeTime / 60} minutes)`,
            mode: "DEMO"
          }
        }, null, 2));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "ERROR", error: err.message }, null, 2));
      }
    })();
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

  // Automated 5-Minute Inbound Keep-Alive Ping to keep Render Awake 24/7
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://pocket-signal-bot-dp4q.onrender.com';
  const pingServer = () => {
    https.get(`${RENDER_EXTERNAL_URL}/`, (res) => {
      console.log(`[Keep-Alive Ping] Status: ${res.statusCode} at ${new Date().toISOString()}`);
    }).on('error', (err) => {
      console.warn('[Keep-Alive Ping] Warning:', err.message);
    });
  };

  // Immediate ping + recurring every 5 minutes
  setTimeout(pingServer, 5000);
  setInterval(pingServer, 5 * 60 * 1000);
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
    const myIdStr = me.id.toString();
    console.log(`[Telegram] Logged in as: ${me.firstName} (@${me.username || me.phone}) [ID: ${myIdStr}]`);
    console.log("[System] 👂 Now listening 24/7 for trade signals...\n");

    // Listen for new messages
    telegram.addEventHandler(async (event) => {
      const message = event.message;
      if (!message || !message.text) return;

      const chatId = message.chatId ? message.chatId.toString() : '';
      const textTrim = message.text.trim();

      // 1. Interactive Telegram Commands in Saved Messages (Chat with Yourself)
      if (chatId === myIdStr || (message.peerId && message.peerId.userId && message.peerId.userId.toString() === myIdStr)) {
        if (textTrim === "/status") {
          console.log("[Telegram Command] User requested /status");
          await telegram.sendMessage("me", {
            message: `🤖 Pocket Option Signal Bot (Cloud 24/7)\n\n` +
                     `• Server: ONLINE 🟢 (Render Frankfurt)\n` +
                     `• Broker: Connected & Authenticated\n` +
                     `• Mode: ${IS_DEMO ? "DEMO ACCOUNT" : "REAL ACCOUNT"}\n` +
                     `• Fixed Stake: $${TRADE_AMOUNT}\n` +
                     `• Target Channel: RAI FAIR TRADER\n\n` +
                     `Your bot is listening 24/7. Your laptop can be completely off!`
          });
          return;
        }

        if (textTrim === "/test") {
          console.log("[Telegram Command] User requested /test trade");
          await telegram.sendMessage("me", {
            message: `⏳ Placing test trade on Pocket Option Demo (AUD/CAD OTC, CALL, 3m, $${TRADE_AMOUNT})...`
          });
          try {
            await pocket.openOrder({
              asset: "AUDCAD_otc",
              amount: TRADE_AMOUNT,
              action: "call",
              time: 180
            });
            await telegram.sendMessage("me", {
              message: `✅ Test trade successfully executed on Pocket Option Demo!\nCheck your Pocket Option screen under 'Opened' or 'Closed' trades.`
            });
          } catch (err) {
            await telegram.sendMessage("me", {
              message: `❌ Test trade failed: ${err.message}`
            });
          }
          return;
        }
      }

      // 2. Filter specifically for Rai Fair Trader channel
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

      // Guard: Do not execute stale signals older than 120 seconds
      if (dateNow - msgDate > 120) {
        console.warn(`⚠️ IGNORED: Signal is stale (Received ${dateNow - msgDate}s after broadcast).`);
        return;
      }

      // Parse Signal
      const parsed = parseSignal(message.text);
      if (!parsed) {
        console.warn("⚠️ Could not parse trade parameters from message:", message.text);
        return;
      }

      console.log(`[Parsed Trade] Asset: ${parsed.pocketAsset} | Expiry: ${parsed.minutes}m (${parsed.durationSeconds}s) | Action: ${parsed.action.toUpperCase()}`);

      // Notify User on Telegram Saved Messages
      try {
        await telegram.sendMessage("me", {
          message: `⚡ [SIGNAL DETECTED FROM RAI]\n` +
                   `💱 Asset: ${parsed.asset}\n` +
                   `⏱️ Expiry: ${parsed.minutes} min\n` +
                   `📊 Action: ${parsed.action.toUpperCase()} ${parsed.action === 'call' ? '🟢 CALL' : '🔴 SELL'}\n` +
                   `💰 Stake: $${TRADE_AMOUNT} (DEMO)\n\n` +
                   `⏳ Dispatching order to Pocket Option...`
        });
      } catch (e) {
        console.warn('[Telegram Alert Error]', e.message);
      }

      // Safety Guard: Check account balance floor
      if (pocket.balance !== null && pocket.balance < MIN_BALANCE_FLOOR) {
        console.error(`🛑 HALT: Account balance ($${pocket.balance}) is below safety floor ($${MIN_BALANCE_FLOOR}). Order cancelled.`);
        try {
          await telegram.sendMessage("me", {
            message: `🛑 ORDER CANCELLED: Account balance ($${pocket.balance}) is below safety floor ($${MIN_BALANCE_FLOOR}).`
          });
        } catch (e) {}
        return;
      }

      // Execute Trade
      try {
        await pocket.openOrder({
          asset: parsed.pocketAsset,
          amount: TRADE_AMOUNT,
          action: parsed.action,
          time: parsed.durationSeconds
        });
        console.log(`✅ [Trade Dispatched] Successfully sent ${parsed.pocketAsset} ${parsed.action.toUpperCase()} order to broker!`);
        try {
          await telegram.sendMessage("me", {
            message: `✅ [TRADE EXECUTED ON POCKET OPTION]\n` +
                     `Asset: ${parsed.pocketAsset}\n` +
                     `Action: ${parsed.action.toUpperCase()}\n` +
                     `Duration: ${parsed.minutes} min\n` +
                     `Amount: $${TRADE_AMOUNT}\n` +
                     `Mode: DEMO`
          });
        } catch (e) {}
      } catch (err) {
        console.error("❌ Failed to place trade on Pocket Option:", err.message);
        try {
          await telegram.sendMessage("me", {
            message: `❌ Failed to place trade on Pocket Option: ${err.message}`
          });
        } catch (e) {}
      }
    }, new NewMessage({}));

  } catch (err) {
    console.error("Fatal startup error:", err);
    process.exit(1);
  }
}

start();
