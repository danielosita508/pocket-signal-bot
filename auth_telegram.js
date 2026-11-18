const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;

if (!apiId || !apiHash) {
  console.error("❌ ERROR: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in your .env file!");
  process.exit(1);
}

(async () => {
  console.log("=== Telegram One-Time Authentication ===");
  console.log("This will generate your reusable session string.\n");

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Enter your Telegram phone number (with country code, e.g. +1...): "),
    password: async () => await input.text("Enter your 2FA Cloud Password (if enabled, or press enter): "),
    phoneCode: async () => await input.text("Enter the login code sent to your Telegram app: "),
    onError: (err) => console.error("Login Error:", err),
  });

  const sessionSaved = client.session.save();
  console.log("\n✅ LOGIN SUCCESSFUL!");
  console.log("\nYour Session String has been generated.");

  // Append or update in .env
  const envPath = path.join(__dirname, ".env");
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  if (envContent.includes("TELEGRAM_SESSION=")) {
    envContent = envContent.replace(/TELEGRAM_SESSION=.*/g, `TELEGRAM_SESSION="${sessionSaved}"`);
  } else {
    envContent += `\nTELEGRAM_SESSION="${sessionSaved}"\n`;
  }

  fs.writeFileSync(envPath, envContent.trim() + "\n");
  console.log("💾 TELEGRAM_SESSION successfully saved into .env!");
  console.log("You can now run the main bot without logging in again.\n");
  process.exit(0);
})();
