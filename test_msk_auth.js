const WebSocket = require('ws');

const wsUrl = 'wss://api-msk.po.market/socket.io/?EIO=4&transport=websocket';
const cookie = 'PHPSESSID=ou6enphv7fp4nrhg1ikvs4ccbk';

const ws = new WebSocket(wsUrl, {
  headers: {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Origin': 'https://pocketoption.com'
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket Connected to api-msk!');
});

ws.on('message', (data) => {
  const msg = data.toString();
  console.log('[INCOMING]', msg.substring(0, 150));

  if (msg === '2') {
    ws.send('3'); // pong
    return;
  }

  if (msg.startsWith('0')) {
    console.log('Sending 40 (Socket.IO handshake)...');
    ws.send('40');
    return;
  }

  if (msg.startsWith('40')) {
    console.log('Handshake accepted! Sending auth packet...');
    const auth = ['auth', { session: 'ou6enphv7fp4nrhg1ikvs4ccbk', isDemo: 1 }];
    ws.send('42' + JSON.stringify(auth));
    return;
  }

  if (msg.startsWith('42')) {
    try {
      const parsed = JSON.parse(msg.substring(2));
      console.log('EVENT RECEIVED:', parsed[0], JSON.stringify(parsed[1] || '').substring(0, 150));
    } catch (e) {
      console.error('Parse error:', e);
    }
  }
});

ws.on('error', (err) => console.error('Error:', err.message));

setTimeout(() => {
  console.log('Test completed.');
  process.exit(0);
}, 8000);
