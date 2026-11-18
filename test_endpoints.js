const WebSocket = require('ws');

const hosts = [
  'wss://api-fin.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://api-l.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://api-msk.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket',
  'wss://pocketoption.com/socket.io/?EIO=4&transport=websocket',
  'wss://api.pocketoption.com/socket.io/?EIO=4&transport=websocket'
];

const cookie = 'PHPSESSID=ou6enphv7fp4nrhg1ikvs4ccbk';

async function testHost(url) {
  return new Promise((resolve) => {
    console.log(`Testing ${url}...`);
    try {
      const ws = new WebSocket(url, {
        headers: {
          'Cookie': cookie,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Origin': 'https://pocketoption.com'
        },
        handshakeTimeout: 5000
      });

      ws.on('open', () => {
        console.log(`✅ CONNECTED to ${url}!`);
        ws.close();
        resolve(true);
      });

      ws.on('error', (err) => {
        console.log(`❌ ${url}: ${err.message}`);
        resolve(false);
      });
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
      resolve(false);
    }
  });
}

(async () => {
  for (const h of hosts) {
    await testHost(h);
  }
  process.exit(0);
})();
