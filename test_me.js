const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

(async () => {
  const client = new TelegramClient(
    new StringSession(process.env.TELEGRAM_SESSION),
    parseInt(process.env.TELEGRAM_API_ID, 10),
    process.env.TELEGRAM_API_HASH,
    { connectionRetries: 5 }
  );
  await client.connect();
  const me = await client.getMe();
  console.log(`✅ CONNECTED! Name: ${me.firstName} ${me.lastName || ''} | Phone: +${me.phone} | ID: ${me.id}`);
  process.exit(0);
})();
