const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

console.log('Testing TelegramClient methods:');
const client = new TelegramClient(new StringSession(""), 36242476, "d1ea027165bec5bdb70cb70280b873c2", {});
console.log('sendCode exists:', typeof client.sendCode);
console.log('signInUser exists:', typeof client.signInUser);
console.log('invoke exists:', typeof client.invoke);
