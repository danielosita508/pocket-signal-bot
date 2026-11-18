const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;

const phone = process.argv[2];

if (!phone) {
  console.error("Usage: node request_telegram_code.js <phone_number>");
  process.exit(1);
}

(async () => {
  try {
    console.log(`[Telegram Auth] Connecting to Telegram servers...`);
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.connect();

    console.log(`[Telegram Auth] Requesting code for ${phone}...`);
    const { phoneCodeHash, isCodeViaApp } = await client.sendCode(
      { apiId, apiHash },
      phone
    );

    const state = {
      phone,
      phoneCodeHash,
      isCodeViaApp,
      session: client.session.save()
    };

    fs.writeFileSync(
      path.join(__dirname, "auth_state.json"),
      JSON.stringify(state, null, 2)
    );

    console.log(`✅ CODE SENT SUCCESSFULLY!`);
    console.log(`Telegram sent the code to: ${isCodeViaApp ? 'your Telegram App' : 'SMS'}`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to request code:", err.message);
    process.exit(1);
  }
})();
