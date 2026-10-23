/** Coinbase Exchange public BTC/USD last-trade feed.
 * Read-only market observation. No order entry, forecasts or betting signals.
 */
'use strict';
(() => {
  const q = id => document.getElementById(id);
  const nodes = {
    price: q('live-price'),
    status: q('live-status'),
    statusText: q('live-status-text'),
    time: q('live-trade-time'),
    age: q('live-data-age')
  };
  if (Object.values(nodes).some(v => !v)) return;
  const priceFormat = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2
  });
  const URL = 'wss://ws-feed.exchange.coinbase.com';
  const PRODUCT = 'BTC-USD';
  const FRESH_MS = 30000;
  let socket = null;
  let retryHandle = null;
  let retryCount = 0;
  let lastExchangeTime = 0;
  let lastReceivedAt = 0;
  let lastHeartbeatAt = 0;
  let lastSeq = null;
  let closing = false;

  function state(type, message) {
    if (nodes.status.dataset.state !== type) nodes.status.dataset.state = type;
    if (nodes.statusText.textContent !== message) nodes.statusText.textContent = message;
  }
  function checkFreshness() {
    const now = Date.now();
    const connected = socket && socket.readyState === WebSocket.OPEN;
    if (!lastExchangeTime) {
      nodes.age.textContent = 'No trade received yet';
      state(connected ? 'connecting' : 'offline',
        connected ? 'Connected — awaiting trade' : 'Offline — reconnecting');
      return;
    }
    const elapsed = Math.max(0, Math.floor((now - lastExchangeTime) / 1000));
    nodes.age.textContent = 'Last trade ' + elapsed + 's ago';
    if (!connected) {
      state('offline', 'Disconnected — last observed trade');
    } else if (now - lastExchangeTime > FRESH_MS || now - lastReceivedAt > FRESH_MS ||
               (lastHeartbeatAt && now - lastHeartbeatAt > 15000)) {
      state('stale', 'Stale data — check connection');
    } else {
      state('live', 'Recent exchange trade');
    }
  }
  function reconnect() {
    if (closing || retryHandle !== null) return;
    retryCount += 1;
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(retryCount, 5)));
    retryHandle = setTimeout(() => {
      retryHandle = null;
      connect();
    }, delay);
  }
  function connect() {
    if (closing) return;
    if (!('WebSocket' in window)) {
      state('offline', 'Live data unavailable in this browser');
      nodes.age.textContent = 'WebSocket not supported';
      return;
    }
    if (socket && (socket.readyState === WebSocket.OPEN ||
                   socket.readyState === WebSocket.CONNECTING)) return;
    state('connecting', 'Connecting to Coinbase Exchange');
    try {
      const connection = new WebSocket(URL);
      socket = connection;
      connection.addEventListener('open', () => {
        if (socket !== connection) return;
        retryCount = 0;
        lastSeq = null;
        lastHeartbeatAt = 0;
        connection.send(JSON.stringify({
          type: 'subscribe', product_ids: [PRODUCT], channels: ['ticker', 'heartbeat']
        }));
        checkFreshness();
      });
      connection.addEventListener('message', event => {
        if (socket !== connection) return;
        let m;
        try { m = JSON.parse(event.data); } catch { return; }
        if (m.product_id !== PRODUCT) return;
        if (m.type === 'heartbeat') {
          lastHeartbeatAt = Date.now();
          return;
        }
        if (m.type !== 'ticker') return;
        const price = Number(m.price);
        const stamp = Date.parse(m.time);
        const seq = Number(m.sequence);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(stamp)) return;
        if (stamp > Date.now() + 30000 || stamp < lastExchangeTime) return;
        if (Number.isSafeInteger(seq) && seq >= 0) {
          if (lastSeq !== null && seq <= lastSeq) return;
          lastSeq = seq;
        }
        lastExchangeTime = stamp;
        lastReceivedAt = Date.now();
        nodes.price.textContent = priceFormat.format(price);
        nodes.time.textContent = new Date(stamp).toLocaleString('en-US', {
          timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }) + ' UTC';
        checkFreshness();
      });
      connection.addEventListener('error', () => {
        if (socket === connection) connection.close();
      });
      connection.addEventListener('close', () => {
        if (socket !== connection) return;
        socket = null;
        checkFreshness();
        reconnect();
      });
    } catch (e) {
      socket = null;
      checkFreshness();
      reconnect();
    }
  }
  const interval = setInterval(checkFreshness, 1000);
  window.addEventListener('pagehide', () => {
    closing = true;
    clearInterval(interval);
    if (retryHandle !== null) clearTimeout(retryHandle);
    if (socket) socket.close();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkFreshness();
      if (!socket && retryHandle === null) connect();
    }
  });
  connect();
})();
