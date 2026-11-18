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

  console.log("Searching user dialogs for 'RAI' or channel ID 2684722871...");
  const dialogs = await client.getDialogs({ limit: 50 });

  let found = null;
  for (const d of dialogs) {
    const title = d.title || (d.entity ? (d.entity.title || d.entity.username) : '');
    const idStr = d.id ? d.id.toString() : '';
    if (title && (title.includes("RAI") || title.includes("FAIR TRADER") || idStr.includes("2684722871"))) {
      found = d;
      console.log(`✅ FOUND CHANNEL: "${title}" | ID: ${d.id}`);
      break;
    }
  }

  if (!found) {
    console.log("Could not find by title in top 50 dialogs. Listing channels:");
    dialogs.slice(0, 15).forEach(d => {
      console.log(`  - [${d.id}] ${d.title || 'No Title'}`);
    });
  } else {
    console.log("Fetching last 3 messages from the channel...");
    const messages = await client.getMessages(found.entity, { limit: 3 });
    messages.forEach((m, i) => {
      console.log(`\n--- Message ${i + 1} (${new Date(m.date * 1000).toLocaleString()}) ---`);
      console.log(m.text ? m.text.substring(0, 150) : '[Media/Photo]');
    });
  }

  process.exit(0);
})();
