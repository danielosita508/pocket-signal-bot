const WebSocket = require('ws');
const EventEmitter = require('events');

class PocketOptionClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessionToken = options.sessionToken || process.env.POCKET_SESSION_TOKEN;
    this.uid = options.uid || process.env.POCKET_UID;
    this.isDemo = options.isDemo !== undefined ? options.isDemo : 1; // 1 = Demo, 0 = Real
    this.wsUrl = options.wsUrl || 'wss://demo-api-eu.po.market/socket.io/?EIO=4&transport=websocket';
    this.ws = null;
    this.pingTimer = null;
    this.authenticated = false;
    this.balance = 10000; // Demo default
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`[Pocket Option] Connecting to ${this.wsUrl}...`);
      this.ws = new WebSocket(this.wsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Origin': 'https://pocketoption.com'
        }
      });

      this.ws.on('open', () => {
        console.log('[Pocket Option] ✅ WebSocket Connected.');
      });

      this.ws.on('message', (data) => {
        const msg = data.toString();
        this.handleMessage(msg, resolve);
      });

      this.ws.on('error', (err) => {
        console.error('[Pocket Option] WebSocket Error:', err.message);
        this.emit('error', err);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[Pocket Option] Connection closed (${code}): ${reason}`);
        this.authenticated = false;
        clearInterval(this.pingTimer);
        this.emit('close');
      });
    });
  }

  handleMessage(msg, onConnected) {
    // Engine.IO Heartbeat
    if (msg === '2') {
      this.ws.send('3'); // Reply pong
      return;
    }

    // Engine.IO open handshake: 0{"sid":"..."}
    if (msg.startsWith('0')) {
      this.ws.send('40'); // Socket.io handshake
      return;
    }

    // Socket.io connected: 40{"sid":"..."}
    if (msg.startsWith('40')) {
      this.sendAuth();
      return;
    }

    // Socket.io event or binary event
    if (msg.startsWith('42') || msg.startsWith('45')) {
      try {
        if (msg.includes('auth/success') || msg.includes('updateAssets')) {
          if (!this.authenticated) {
            this.authenticated = true;
            console.log(`[Pocket Option] ✅ AUTH SUCCESS! Logged in as UID: ${this.uid} (Mode: ${this.isDemo ? 'DEMO' : 'REAL'})`);
            this.emit('authenticated');
            if (onConnected) onConnected();
          }
        }

        if (msg.startsWith('42')) {
          const eventData = JSON.parse(msg.substring(2));
          const [eventName, payload] = eventData;

          if (eventName === 'successOpenOrder') {
            console.log('[Pocket Option] 🎯 ORDER EXECUTED SUCCESSFULLY:', payload);
            this.emit('orderSuccess', payload);
          } else if (eventName === 'failOpenOrder') {
            console.error('[Pocket Option] ❌ ORDER FAILED:', payload);
            this.emit('orderFail', payload);
          }
        }
      } catch (e) {
        // Non-JSON or binary placeholder
      }
    }
  }

  sendAuth() {
    console.log('[Pocket Option] Sending authentication token...');
    const authPayload = [
      "auth",
      {
        "sessionToken": this.sessionToken,
        "uid": String(this.uid),
        "lang": "en"
      }
    ];
    this.ws.send('42' + JSON.stringify(authPayload));
  }

  openOrder({ asset, amount, action, time }) {
    if (!this.authenticated) {
      throw new Error('Cannot open order: Not authenticated with Pocket Option');
    }

    console.log(`[Pocket Option] 🚀 DISPATCHING ${action.toUpperCase()} ORDER:`);
    console.log(`  • Asset:  ${asset}`);
    console.log(`  • Stake:  $${amount}`);
    console.log(`  • Expiry: ${time}s`);
    console.log(`  • Demo:   ${this.isDemo ? 'YES' : 'NO'}`);

    const orderPayload = [
      'openOrder',
      {
        asset: asset,
        amount: Number(amount),
        action: action.toLowerCase(), // 'call' or 'put'
        time: Number(time),           // seconds (e.g. 240)
        isDemo: this.isDemo ? 1 : 0
      }
    ];

    this.ws.send('42' + JSON.stringify(orderPayload));
  }

  disconnect() {
    if (this.ws) {
      clearInterval(this.pingTimer);
      this.ws.close();
    }
  }
}

module.exports = PocketOptionClient;
