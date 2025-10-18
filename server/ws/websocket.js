const WebSocket = require("ws");
const admin = require("../firebaseAdmin"); // Firebase admin instance for token verification
const { EventEmitter } = require("events");
const Masjid = require("../models/Masjid");

// Structure: { masjidId: Map(deviceId -> { ws, status }) }
const masjidConnections = new Map();
// quick alias
const masjidDevices = masjidConnections;

  // Broadcast queue per masjid to avoid blocking the event loop on heavy sends
const broadcastQueues = new Map();

// Track active streamers (masjidId -> Set of ws)
const masjidStreamers = new Map();
// presence broadcast timers per masjid to throttle frequent updates
const presenceTimers = new Map();

async function getPresenceForMasjid(masjidId) {
  const conns = masjidDevices.get(masjidId);
  const onlineDevices = conns ? Array.from(conns.keys()) : [];
  // Try to get registered devices from DB for total and registeredDevices
  let registeredDevices = [];
  try {
    const m = await Masjid.findOne({ masjidId }).lean();
    if (m && Array.isArray(m.devices)) registeredDevices = m.devices;
  } catch (e) {
    console.warn('Failed to load masjid devices from DB', e && e.message);
  }
  const total = registeredDevices.length || onlineDevices.length;
  const offline = Math.max(0, total - onlineDevices.length);
  return { masjidId, total, online: onlineDevices.length, offline, onlineDevices, registeredDevices };
}

async function broadcastPresence(masjidId) {
  const presence = await getPresenceForMasjid(masjidId);
  const payload = JSON.stringify({ type: 'presence-update', ...presence });
  // Send to all streamers for this masjid
  const s = masjidStreamers.get(masjidId);
  if (!s) return;
  for (const ws of s) {
    safeSend(ws, payload);
  }
}

function schedulePresenceBroadcast(masjidId) {
  // throttle to max 1 per second
  if (presenceTimers.has(masjidId)) return; // already scheduled
  presenceTimers.set(masjidId, true);
  setTimeout(async () => {
    presenceTimers.delete(masjidId);
    try { await broadcastPresence(masjidId); } catch (e) { console.error('Presence broadcast error', e); }
  }, 1000);
}

function safeSend(ws, msg) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  } catch (err) {
    console.error("Safe send error:", err);
  }
}

function enqueueBroadcast(masjidId, msg) {
  // msg can be string or Buffer
  if (!broadcastQueues.has(masjidId)) broadcastQueues.set(masjidId, []);
  const q = broadcastQueues.get(masjidId);
  q.push(msg);
  // Schedule drain next tick
  setImmediate(() => {
    const queue = broadcastQueues.get(masjidId) || [];
    if (queue.length === 0) return;
    // Drain small batches to avoid blocking
    const batchSize = 200;
    for (let i = 0; i < Math.min(batchSize, queue.length); i++) {
      const m = queue.shift();
      const conns = masjidConnections.get(masjidId);
      if (!conns) continue;
      for (const { ws } of conns.values()) {
        try {
          if (Buffer.isBuffer(m)) ws.send(m);
          else ws.send(m);
        } catch (err) {
          safeSend(ws, typeof m === 'string' ? m : m);
        }
      }
    }
  });
}

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws" });
  const emitter = new EventEmitter();

  // Log presence of shared secret for easier testing (do NOT log secret value)
  if (process.env.MASJID_SHARED_SECRET) {
    console.log('🔐 MASJID_SHARED_SECRET is configured (using shared-key auth fallback)');
  } else {
    console.log('⚠️ MASJID_SHARED_SECRET not set — devices must authenticate with Firebase tokens');
  }

  wss.on("connection", async (ws, req) => {
    const remoteIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
    console.log("✅ New WebSocket connection", { url: req.url, ip: remoteIp });

    let registered = false;
    let masjidId = null;
    let deviceId = null;

    // attach status and alive
    ws.isAlive = true;
    ws.status = "online";

    ws.on("message", async (msg, isBinary) => {
      try {
        if (isBinary) {
          const len = msg.length || (msg.byteLength || 0);
          console.log(`📥 Binary frame received from ${remoteIp} (streamer=${!!ws._streamer}) len=${len} bytes masjid=${ws._masjidId || 'unknown'}`);
          // If this is binary, treat as audio chunk from a streamer
          if (ws._streamer && ws._masjidId) {
            const masjidIdStream = ws._masjidId;
            // enqueue Buffer (Node Buffer) to broadcast queue
            const buffer = Buffer.from(msg);
            enqueueBroadcast(masjidIdStream, buffer);
          }
          return;
        }

        // Expect text JSON messages
        const txt = msg.toString();
        let data;
        try {
          data = JSON.parse(txt);
        } catch (err) {
          console.warn(`⚠️ Non-JSON text message from ${remoteIp}:`, txt.substring(0, 200));
          return;
        }
        console.log(`📨 JSON message from ${remoteIp}: type=${data.type || 'unknown'} masjidId=${data.masjidId || data.masjidId}`);

      // ===== Registration =====
      // { type: 'register', masjidId, deviceId, token?, key? }
  if (data.type === "register") {
        const { masjidId: mId, deviceId: dId, token, key } = data;
        if (!mId || !dId) {
          safeSend(ws, JSON.stringify({ type: "error", message: "Missing registration info" }));
          return;
        }

        // Auth: try Firebase token first, else fallback to shared key
        let authOk = false;
        try {
          if (token) {
            const decoded = await admin.auth().verifyIdToken(token);
            if (decoded && decoded.uid) authOk = true;
          } else if (key && process.env.MASJID_SHARED_SECRET && key === process.env.MASJID_SHARED_SECRET) {
            // Simple shared-secret fallback (use per-masjid secrets in production!)
            authOk = true;
          }
        } catch (err) {
          console.warn("Token verification failed for device", dId, err && err.message);
        }


        if (!authOk) {
          console.warn(`Authentication failed for register attempt from ${remoteIp} masjid=${mId} device=${dId}`);
          safeSend(ws, JSON.stringify({ type: "error", message: "Authentication failed" }));
          try { ws.close(); } catch (e) {}
          return;
        }

  masjidId = mId;
  deviceId = dId;

  if (!masjidDevices.has(masjidId)) masjidDevices.set(masjidId, new Map());
  const conns = masjidDevices.get(masjidId);
  conns.set(deviceId, { ws, status: "online" });
  registered = true;

  console.log(`Device registered: ${deviceId} under Masjid: ${masjidId} from ${remoteIp}`);
  safeSend(ws, JSON.stringify({ type: "ack", message: "Registered successfully" }));
  // Persist deviceId into Masjid.devices array if not already present
  try {
    Masjid.updateOne({ masjidId }, { $addToSet: { devices: deviceId } }).catch(err => console.error('Failed to persist device in Masjid:', err));
  } catch (e) { console.error('Error updating masjid devices:', e); }
  emitter.emit("registered", { masjidId, deviceId });

  // presence update (throttled)
  schedulePresenceBroadcast(masjidId);
        return;
      }

      // Streamer registration: { type: 'stream-register', masjidId, role: 'streamer', token?, key? }
      if (data.type === 'stream-register') {
        const { masjidId: mId, role, token, key } = data;
        if (!mId || role !== 'streamer') {
          safeSend(ws, JSON.stringify({ type: "error", message: "Missing stream registration info" }));
          return;
        }

        // Authenticate streamer (reuse auth logic)
        let authOk = false;
        try {
          if (token) {
            const decoded = await admin.auth().verifyIdToken(token);
            if (decoded && decoded.uid) authOk = true;
          } else if (key && process.env.MASJID_SHARED_SECRET && key === process.env.MASJID_SHARED_SECRET) {
            authOk = true;
          }
        } catch (err) {
          console.warn('Stream token verification failed', err && err.message);
        }
        if (!authOk) {
          safeSend(ws, JSON.stringify({ type: "error", message: "Stream auth failed" }));
          try { ws.close(); } catch (e) {}
          return;
        }

        ws._streamer = true;
        ws._masjidId = mId;
        if (!masjidStreamers.has(mId)) masjidStreamers.set(mId, new Set());
        masjidStreamers.get(mId).add(ws);
        console.log(`Streamer registered for masjid ${mId}`);
        safeSend(ws, JSON.stringify({ type: 'ack', message: 'Streamer registered' }));
        // Immediately send current presence to this streamer so dashboards get an up-to-date view
        try {
          await broadcastPresence(mId);
        } catch (err) {
          console.warn('Failed to send immediate presence on streamer registration', err && err.message);
        }
        return;
      }

      // ===== Status update =====
      if (data.type === "status" && registered) {
        const s = data.status === "online" ? "online" : "offline";
        const conns = masjidConnections.get(masjidId);
        if (conns && conns.has(deviceId)) conns.get(deviceId).status = s;
        ws.status = s;
        console.log(`Device ${deviceId} status: ${s}`);
        return;
      }

      // Other message types can be handled here
    } catch (err) {
      console.error('WebSocket message handler error:', err);
    }
    });

    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("close", () => {
      if (registered && masjidId && deviceId && masjidConnections.has(masjidId)) {
        const conns = masjidConnections.get(masjidId);
  conns.delete(deviceId);
  if (conns.size === 0) masjidDevices.delete(masjidId);
  console.log(`Device disconnected: ${deviceId} from Masjid: ${masjidId}`);
  emitter.emit("disconnected", { masjidId, deviceId });

  // presence update (throttled)
  schedulePresenceBroadcast(masjidId);
      }

      // If this ws was a streamer, remove from streamers set
      if (ws._streamer && ws._masjidId) {
        const s = masjidStreamers.get(ws._masjidId);
        if (s) {
          s.delete(ws);
          if (s.size === 0) masjidStreamers.delete(ws._masjidId);
        }
        console.log(`Streamer disconnected for masjid: ${ws._masjidId}`);
      }
    });

    ws.on("error", (err) => console.error("WebSocket error:", err));
  });

  // Heartbeat: ping clients and terminate dead ones
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch (e) {}
    });
  }, 30000);

  console.log("🛰 WebSocket server initialized (robust mode)");

  return {
    broadcastToMasjid: (masjidId, message) => {
      const msgStr = JSON.stringify(message);
      enqueueBroadcast(masjidId, msgStr);
    },
    // immediate broadcast (sync, try/catch)
    broadcastImmediate: (masjidId, message) => {
      const msgStr = JSON.stringify(message);
      const conns = masjidConnections.get(masjidId);
      if (!conns) return;
      for (const { ws } of conns.values()) {
        safeSend(ws, msgStr);
      }
    },
    getMasjidStatus: (masjidId) => {
      if (!masjidConnections.has(masjidId)) return [];
      const conns = masjidConnections.get(masjidId);
      return Array.from(conns.entries()).filter(([_, v]) => v.ws.readyState === WebSocket.OPEN).map(([id]) => id);
    },
    // expose internal maps for monitoring (read-only recommended)
    _internal: { masjidConnections, broadcastQueues, emitter, masjidStreamers, presenceTimers },
  };
}

module.exports = { setupWebSocket };