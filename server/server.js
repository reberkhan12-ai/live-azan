const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const http = require("http"); // Needed for WebSocket server
const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/auth");
const masjidRoutes = require("./routes/masjid");
const deviceRoutes = require("./routes/device");
const adminRoutes = require("./routes/admin");

// Import WebSocket setup
const { setupWebSocket } = require("./ws/websocket");

const app = express();

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== Connect to MongoDB =====
connectDB();

// ===== API Routes =====
app.use("/api/auth", authRoutes);
app.use("/api/masjid", masjidRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/admin", adminRoutes);

// ===== Create HTTP server =====
const server = http.createServer(app);

// ===== Initialize WebSocket server =====
const wsHelpers = setupWebSocket(server);

// Make WebSocket helpers accessible in routes/controllers
app.locals.broadcastToMasjid = wsHelpers.broadcastToMasjid;
app.locals.getMasjidStatus = wsHelpers.getMasjidStatus;
// expose internals for admin/debug (read-only)
app.locals._ws = wsHelpers._internal || {};

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));