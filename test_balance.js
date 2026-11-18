const WebSocket = require('ws');

const wsUrl = 'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket';

const ws = new WebSocket(wsUrl, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Origin': 'https://pocketoption.com'
  }
});

ws.on('open', () => console.log('WebSocket Connected.'));

ws.on('message', (d) => {
  const msg = d.toString();
  if (msg === '2') {
    ws.send('3');
    return;
  }
  if (msg.startsWith('0')) {
    ws.send('40');
    return;
  }
  if (msg.startsWith('40')) {
    console.log('Sending auth...');
    const payload = [
      "auth",
      {
        "sessionToken": "eae4eeef4babe492f24b6c606c4a0575",
        "uid": "135107664",
        "lang": "en"
      }
    ];
    ws.send('42' + JSON.stringify(payload));
    return;
  }

  // Print auth responses and user messages
  if (msg.startsWith('42') || msg.startsWith('45')) {
    console.log('[EVENT]', msg.substring(0, 150));
  }
});

ws.on('error', (e) => console.error('Error:', e.message));

setTimeout(() => {
  ws.close();
  process.exit(0);
}, 6000);
