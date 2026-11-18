const WebSocket = require('ws');

const hosts = [
  'wss://api-msk.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket'
];

async function test(wsUrl) {
  return new Promise((resolve) => {
    console.log(`Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Origin': 'https://pocketoption.com'
      }
    });

    ws.on('open', () => console.log(`[${wsUrl}] Connected.`));

    ws.on('message', (d) => {
      const msg = d.toString();
      console.log(`[${wsUrl}] MSG:`, msg.substring(0, 150));

      if (msg === '2') {
        ws.send('3');
      } else if (msg.startsWith('0')) {
        ws.send('40');
      } else if (msg.startsWith('40')) {
        console.log(`[${wsUrl}] Handshake OK! Sending auth...`);
        const payload = [
          "auth",
          {
            "sessionToken": "eae4eeef4babe492f24b6c606c4a0575",
            "uid": "135107664",
            "lang": "en"
          }
        ];
        ws.send('42' + JSON.stringify(payload));
      } else if (msg.includes('auth/success') || msg.includes('success')) {
        console.log(`🎉 [${wsUrl}] AUTHENTICATED SUCCESSFULLY! Result:`, msg);
        ws.close();
        resolve(true);
      }
    });

    ws.on('error', (e) => {
      console.log(`[${wsUrl}] Error:`, e.message);
      resolve(false);
    });

    setTimeout(() => {
      ws.close();
      resolve(false);
    }, 5000);
  });
}

(async () => {
  for (const h of hosts) {
    await test(h);
  }
  process.exit(0);
})();
