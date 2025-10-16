const WebSocket = require("ws");
const admin = require("../firebaseAdmin"); // Firebase admin instance for token verification

// Structure: { masjidId: { deviceId: wsConnection, ... }, ... }
const masjidConnections = {};

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    console.log("✅ New WebSocket connection");

    let registered = false;
    let masjidId = null;
    let deviceId = null;

    // Listen for messages from devices
    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg);

        // ===== Registration message =====
        // { type: "register", masjidId: "...", deviceId: "...", token: "..." }
        if (data.type === "register") {
          const { masjidId: mId, deviceId: dId, token } = data;

          if (!token || !mId || !dId) {
            ws.send(JSON.stringify({ type: "error", message: "Missing registration info" }));
            return;
          }

          // Verify Firebase token
          try {
            const decoded = await admin.auth().verifyIdToken(token);
            if (!decoded || !decoded.email) {
              ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
              ws.close();
              return;
            }
          } catch (err) {
            ws.send(JSON.stringify({ type: "error", message: "Token verification failed" }));
            ws.close();
            return;
          }

          masjidId = mId;
          deviceId = dId;

          if (!masjidConnections[masjidId]) masjidConnections[masjidId] = {};
          masjidConnections[masjidId][deviceId] = ws;
          registered = true;

          console.log(`Device registered: ${deviceId} under Masjid: ${masjidId}`);

          // Send acknowledgment
          ws.send(JSON.stringify({ type: "ack", message: "Registered successfully" }));
        }

        // ===== Status update message =====
        // { type: "status", status: "online"/"offline" }
        if (data.type === "status" && registered) {
          ws.status = data.status === "online" ? "online" : "offline";

          // Optionally broadcast to other services about status
          console.log(`Device ${deviceId} status: ${ws.status}`);
        }

      } catch (err) {
        console.error("WebSocket message parse error:", err);
      }
    });

    // Heartbeat/ping-pong to detect dead connections
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    // Remove device on disconnect
    ws.on("close", () => {
      if (registered && masjidId && deviceId && masjidConnections[masjidId]) {
        delete masjidConnections[masjidId][deviceId];
        console.log(`Device disconnected: ${deviceId} from Masjid: ${masjidId}`);
      }
    });

    ws.on("error", (err) => console.error("WebSocket error:", err));
  });

  // Interval to terminate dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);

  console.log("🛰 WebSocket server initialized");

  return {
    // Broadcast a message to all devices of a masjid
    broadcastToMasjid: (masjidId, message) => {
      if (!masjidConnections[masjidId]) return;
      const msgStr = JSON.stringify(message);
      Object.values(masjidConnections[masjidId]).forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(msgStr);
      });
    },

    // Get online device IDs for a masjid
    getMasjidStatus: (masjidId) => {
      if (!masjidConnections[masjidId]) return [];
      return Object.entries(masjidConnections[masjidId])
        .filter(([_, ws]) => ws.readyState === WebSocket.OPEN)
        .map(([deviceId]) => deviceId);
    },
  };
}

module.exports = { setupWebSocket };