require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http"); // Needed for WebSocket server
const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/auth");
const masjidRoutes = require("./routes/masjid");
const deviceRoutes = require("./routes/device");

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

// ===== Create HTTP server =====
const server = http.createServer(app);

// ===== Initialize WebSocket server =====
const { broadcastToMasjid, getMasjidStatus } = setupWebSocket(server);

// Make WebSocket helpers accessible in routes/controllers
app.locals.broadcastToMasjid = broadcastToMasjid;
app.locals.getMasjidStatus = getMasjidStatus;

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));