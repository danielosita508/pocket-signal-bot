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
    this.authenticated = false;
    this.connecting = false;
    this.balance = 10000;
    this.reconnectTimer = null;
    this.pingInterval = null;
  }

  connect() {
    if (this.authenticated) return Promise.resolve();
    if (this.connecting) {
      return new Promise((resolve) => this.once('authenticated', resolve));
    }

    this.connecting = true;

    return new Promise((resolve, reject) => {
      console.log(`[Pocket Option] Connecting to ${this.wsUrl}...`);
      
      try {
        if (this.ws) {
          try { this.ws.terminate(); } catch (e) {}
        }

        this.ws = new WebSocket(this.wsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            'Origin': 'https://pocketoption.com'
          },
          handshakeTimeout: 8000
        });

        const authTimeout = setTimeout(() => {
          if (!this.authenticated) {
            console.warn('[Pocket Option] Auth timeout. Reconnecting...');
            this.connecting = false;
            this.scheduleReconnect();
          }
        }, 10000);

        this.ws.on('open', () => {
          console.log('[Pocket Option] ✅ WebSocket Connected.');
        });

        this.ws.on('message', (data) => {
          const msg = data.toString();
          this.handleMessage(msg, () => {
            clearTimeout(authTimeout);
            this.connecting = false;
            resolve();
          });
        });

        this.ws.on('error', (err) => {
          console.error('[Pocket Option] WebSocket Error:', err.message);
          this.authenticated = false;
          this.connecting = false;
          clearTimeout(authTimeout);
          this.scheduleReconnect();
        });

        this.ws.on('close', (code, reason) => {
          console.log(`[Pocket Option] Connection closed (${code}). Scheduling reconnect...`);
          this.authenticated = false;
          this.connecting = false;
          clearTimeout(authTimeout);
          clearInterval(this.pingInterval);
          this.scheduleReconnect();
        });

      } catch (err) {
        console.error('[Pocket Option] Connection exception:', err.message);
        this.connecting = false;
        this.scheduleReconnect();
        reject(err);
      }
    });
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[Pocket Option] 🔄 Auto-reconnecting to server...');
      this.connect().catch(() => {});
    }, 3000);
  }

  handleMessage(msg, onConnected) {
    // Engine.IO Heartbeat (server sends 2, reply 3)
    if (msg === '2') {
      try { this.ws.send('3'); } catch (e) {}
      return;
    }

    // Engine.IO open handshake: 0{"sid":"..."}
    if (msg.startsWith('0')) {
      try { this.ws.send('40'); } catch (e) {}
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
            console.log(`[Pocket Option] ✅ AUTH SUCCESS! UID: ${this.uid} (Mode: ${this.isDemo ? 'DEMO' : 'REAL'})`);
            
            // Start heartbeat ping keeper
            clearInterval(this.pingInterval);
            this.pingInterval = setInterval(() => {
              if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send('2');
              }
            }, 20000);

            this.emit('authenticated');
            if (onConnected) onConnected();
          }
        }

        if (msg.startsWith('42') || msg.startsWith('45')) {
          const raw = msg.startsWith('45') ? msg.substring(msg.indexOf('[')) : msg.substring(2);
          try {
            const eventData = JSON.parse(raw);
            const [eventName, payload] = eventData;

            if (eventName === 'successopenOrder' || eventName === 'successOpenOrder') {
              console.log('[Pocket Option] 🎯 ORDER EXECUTED SUCCESSFULLY BY BROKER:', payload);
              this.emit('orderSuccess', payload);
            } else if (eventName === 'failopenOrder' || eventName === 'failOpenOrder') {
              console.error('[Pocket Option] ❌ BROKER REJECTED ORDER:', payload);
              this.emit('orderFail', payload);
            }
          } catch (e) {}
        }
      } catch (e) {
        // Non-JSON or binary data
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
        "lang": "en",
        "isChart": 1,
        "currentUrl": "cabinet/demo-quick-high-low"
      }
    ];
    try {
      this.ws.send('42' + JSON.stringify(authPayload));
    } catch (e) {
      console.error('[Pocket Option] SendAuth error:', e.message);
    }
  }

  getValidDuration(seconds) {
    const valid = [60, 120, 180, 300, 600, 900, 1800, 2700, 3600];
    const s = Number(seconds) || 180;
    if (valid.includes(s)) return s;
    // Snap to closest supported duration (e.g. 240s -> 180s)
    return valid.reduce((prev, curr) => Math.abs(curr - s) < Math.abs(prev - s) ? curr : prev);
  }

  async openOrder({ asset, amount, action, time }) {
    if (!this.authenticated) {
      console.log('[Pocket Option] Order requested while disconnected. Reconnecting first...');
      await this.connect();
    }

    if (!this.authenticated) {
      throw new Error('Cannot open order: Not authenticated with Pocket Option');
    }

    const validTime = this.getValidDuration(time);

    console.log(`[Pocket Option] 🚀 DISPATCHING ${action.toUpperCase()} ORDER:`);
    console.log(`  • Asset:  ${asset}`);
    console.log(`  • Stake:  $${amount}`);
    console.log(`  • Expiry: ${validTime}s (requested: ${time}s)`);
    console.log(`  • Demo:   ${this.isDemo ? 'YES' : 'NO'}`);

    const requestId = Math.floor(Math.random() * 90000000) + 10000000;
    const orderPayload = [
      'openOrder',
      {
        asset: asset,
        amount: Number(amount),
        action: action.toLowerCase(),
        time: validTime,
        isDemo: this.isDemo ? 1 : 0,
        requestId: requestId,
        optionType: 100
      }
    ];

    console.log('[Pocket Option] Outgoing payload:', JSON.stringify(orderPayload));
    this.ws.send('42' + JSON.stringify(orderPayload));
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.pingInterval);
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = PocketOptionClient;
