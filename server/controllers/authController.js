const User = require("../models/User");
const Masjid = require("../models/Masjid");

// Check or register user after Firebase login
const checkUser = async (req, res) => {
  try {
    const { email, name, photo } = req.user; // extracted from Firebase token
    let user = await User.findOne({ email });

    if (!user) {
      // New user, register
      const role = req.body.role || "Momin"; // default role if not provided
      user = new User({ name, email, photo, role });
      await user.save();
      return res.json({
        success: true,
        role,
        user,
        message: `New user registered as ${role}`,
      });
    }

    // Existing user: check role consistency
    if (req.body.role && req.body.role !== user.role) {
      return res.json({
        success: false,
        role: user.role,
        message: `You are already registered as ${user.role}. Cannot register as ${req.body.role}.`,
      });
    }

    // If user is Imam, check Masjid registration
    if (user.role === "Imam") {
      const masjid = await Masjid.findOne({ userEmail: email });
      return res.json({
        success: true,
        role: "Imam",
        masjidRegistered: !!masjid,
        user,
      });
    }

    // Regular Momin user
    res.json({ success: true, role: user.role, user });
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { checkUser };