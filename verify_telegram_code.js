const { TelegramClient, Api } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const apiId = parseInt(process.env.TELEGRAM_API_ID, 10);
const apiHash = process.env.TELEGRAM_API_HASH;

const code = process.argv[2];
const password = process.argv[3] || "";

if (!code) {
  console.error("Usage: node verify_telegram_code.js <code> [2fa_password]");
  process.exit(1);
}

const statePath = path.join(__dirname, "auth_state.json");
if (!fs.existsSync(statePath)) {
  console.error("❌ auth_state.json not found! Run request_telegram_code.js first.");
  process.exit(1);
}

const state = JSON.parse(fs.readFileSync(statePath, "utf8"));

(async () => {
  try {
    console.log(`[Telegram Auth] Connecting with saved session...`);
    const client = new TelegramClient(new StringSession(state.session), apiId, apiHash, {
      connectionRetries: 5,
    });
    await client.connect();

    console.log(`[Telegram Auth] Submitting verification code: ${code}...`);
    
    // GramJS direct invoke: Api.auth.SignIn
    try {
      const res = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: state.phone,
          phoneCodeHash: state.phoneCodeHash,
          phoneCode: code.trim(),
        })
      );
      console.log(`✅ TELEGRAM AUTHENTICATION COMPLETED SUCCESSFULLY!`);
    } catch (invokeErr) {
      if (invokeErr.message && invokeErr.message.includes("SESSION_PASSWORD_NEEDED")) {
        if (!password) {
          console.error("❌ 2FA_REQUIRED: Your account has a 2FA Cloud Password enabled. Please provide it.");
          process.exit(2);
        }
        console.log("[Telegram Auth] Submitting 2FA Cloud Password...");
        const passwordSrp = await client.computePasswordCheck(password);
        await client.invoke(new Api.auth.CheckPassword({ password: passwordSrp }));
        console.log(`✅ 2FA AUTHENTICATION COMPLETED SUCCESSFULLY!`);
      } else {
        throw invokeErr;
      }
    }

    const savedSession = client.session.save();

    // Update .env
    const envPath = path.join(__dirname, ".env");
    let envContent = fs.readFileSync(envPath, "utf8");

    if (envContent.includes("TELEGRAM_SESSION=")) {
      envContent = envContent.replace(/TELEGRAM_SESSION=.*/g, `TELEGRAM_SESSION="${savedSession}"`);
    } else {
      envContent += `\nTELEGRAM_SESSION="${savedSession}"\n`;
    }

    fs.writeFileSync(envPath, envContent.trim() + "\n");
    console.log(`💾 TELEGRAM_SESSION saved into .env!`);

    // Clean up temporary auth_state.json
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to verify code:", err.message);
    process.exit(1);
  }
})();
