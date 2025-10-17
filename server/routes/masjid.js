const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../middleware/authMiddleware");
const {
  registerMasjid,
  getTotalMomins,
  getMasjidByEmail,
} = require("../controllers/masjidController");

// ===== Routes =====

// Register Masjid
router.post("/", verifyFirebaseToken, registerMasjid);

// Get total momins
router.get("/momins/:masjidId", verifyFirebaseToken, getTotalMomins);

// Get masjid by imam email
router.get("/:email", verifyFirebaseToken, getMasjidByEmail);

// ===== Azan control routes =====

// Start Azan
router.post("/start-azan", verifyFirebaseToken, (req, res) => {
  const { masjidId, imamName } = req.body;

  if (!masjidId)
    return res.status(400).json({ success: false, message: "Masjid ID missing" });

  const broadcast = req.app.locals.broadcastToMasjid;
  if (!broadcast)
    return res.status(500).json({ success: false, message: "WebSocket not initialized" });

  const message = {
    type: "azan",
    action: "start",
    imam: imamName || "Unknown Imam",
    masjidId,
    timestamp: new Date().toISOString(),
  };

  broadcast(masjidId, message);
  console.log(`📢 Azan STARTED for Masjid: ${masjidId}`);
  res.json({ success: true, message: "Azan started and broadcast sent" });
});

// Stop Azan
router.post("/stop-azan", verifyFirebaseToken, (req, res) => {
  const { masjidId } = req.body;

  if (!masjidId)
    return res.status(400).json({ success: false, message: "Masjid ID missing" });

  const broadcast = req.app.locals.broadcastToMasjid;
  if (!broadcast)
    return res.status(500).json({ success: false, message: "WebSocket not initialized" });

  const message = {
    type: "azan",
    action: "stop",
    masjidId,
    timestamp: new Date().toISOString(),
  };

  broadcast(masjidId, message);
  console.log(`🛑 Azan STOPPED for Masjid: ${masjidId}`);
  res.json({ success: true, message: "Azan stopped for all devices" });
});

module.exports = router;