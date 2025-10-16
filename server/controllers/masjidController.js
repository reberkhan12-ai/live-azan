const Masjid = require("../models/Masjid");
const User = require("../models/User");

// Register Masjid
const registerMasjid = async (req, res) => {
  try {
    const { masjidName, address, city, state, pincode } = req.body;
    const userEmail = req.user?.email || req.body.userEmail;

    if (!masjidName || !address || !city || !state || !pincode)
      return res.status(400).json({ success: false, message: "Missing fields" });

    const existing = await Masjid.findOne({ userEmail });
    if (existing)
      return res.json({
        success: false,
        message: "Masjid already registered",
        masjidId: existing.masjidId,
      });

    let masjidId;
    do {
      masjidId = "MASJID-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (await Masjid.findOne({ masjidId }));

    const masjid = new Masjid({
      userEmail,
      masjidName,
      address,
      city,
      state,
      pincode,
      masjidId,
    });

    await masjid.save();
    res.json({ success: true, masjid, masjidId });
  } catch (err) {
    console.error("Masjid error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get total Momins for a masjid
const getTotalMomins = async (req, res) => {
  try {
    const { masjidId } = req.params;
    const momins = await User.find({ role: "Momin", masjidId });
    res.json({ totalMomin: momins.length });
  } catch (err) {
    console.error("Get Momins error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Start Azan
const startAzan = async (req, res) => {
  try {
    const { masjidId, imamName } = req.body;
    if (!masjidId)
      return res.status(400).json({ success: false, message: "Masjid ID required" });

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
  } catch (err) {
    console.error("Start Azan error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Stop Azan
const stopAzan = async (req, res) => {
  try {
    const { masjidId } = req.body;
    if (!masjidId)
      return res.status(400).json({ success: false, message: "Masjid ID required" });

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
  } catch (err) {
    console.error("Stop Azan error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ Get live device status
const getDeviceStatus = async (req, res) => {
  try {
    const { masjidId } = req.params;
    const getStatus = req.app.locals.getMasjidStatus;
    if (!getStatus)
      return res.status(500).json({ success: false, message: "WebSocket not initialized" });

    const onlineDevices = getStatus(masjidId);
    res.json({ success: true, onlineDevices, totalOnline: onlineDevices.length });
  } catch (err) {
    console.error("Device status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  registerMasjid,
  getTotalMomins,
  startAzan,
  stopAzan, // ✅ new
  getDeviceStatus,
};