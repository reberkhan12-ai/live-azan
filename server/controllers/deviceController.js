const User = require("../models/User");

// Get all devices for a masjid
const getDevices = async (req, res) => {
  try {
    const { masjidId } = req.params;
    const momins = await User.find({ role: "Momin", masjidId, deviceId: { $ne: null } });

    // return only existing deviceIds
    const devices = momins.map((m) => ({ deviceId: m.deviceId }));
    res.json({ devices });
  } catch (err) {
    console.error("Devices error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Register or update device for a Momin
const registerDevice = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const email = req.user.email;

    if (!deviceId) return res.status(400).json({ success: false, message: "Missing deviceId" });

    await User.updateOne({ email, role: "Momin" }, { $set: { deviceId } });
    res.json({ success: true });
  } catch (err) {
    console.error("Register device error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getDevices, registerDevice };
