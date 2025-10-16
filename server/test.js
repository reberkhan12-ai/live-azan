// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ===== Middleware =====
app.use(cors({ origin: '*', methods: 'GET,HEAD,PUT,PATCH,POST,DELETE' }));
app.use(express.json());

// ===== MongoDB Connection =====
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected ✅"))
  .catch((err) => console.error("MongoDB connection error:", err));

// ===== Schemas =====
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  photo: String,
  role: { type: String, enum: ["Imam", "Momin"] },
  masjidId: { type: String, default: null },
  deviceId: { type: String, default: null },
});

const masjidSchema = new mongoose.Schema({
  userEmail: { type: String, required: true }, // Imam email
  masjidName: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  masjidId: { type: String, unique: true },
});

const User = mongoose.model("User", userSchema);
const Masjid = mongoose.model("Masjid", masjidSchema);

// ===== Routes =====

// --- Check User (for login flow) ---
app.post("/api/check-user", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.role === "Imam") {
      const masjid = await Masjid.findOne({ userEmail: email });
      return res.json({
        success: true,
        role: "Imam",
        masjidRegistered: !!masjid,
      });
    } else if (user.role === "Momin") {
      return res.json({
        success: true,
        role: "Momin",
      });
    } else {
      return res.json({ success: false, message: "Invalid role" });
    }
  } catch (err) {
    console.error("Check-user error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Get all devices for a masjid ---
app.get("/api/devices/:masjidId", async (req, res) => {
  const { masjidId } = req.params;
  const devices = [
    { deviceId: masjidId + "-esp32-1" },
    { deviceId: masjidId + "-esp32-2" },
    { deviceId: masjidId + "-esp32-3" },
  ];
  res.json({ devices });
});

// --- Get total momin for a masjid ---
app.get("/api/masjid-momins/:masjidId", async (req, res) => {
  const momins = await User.find({ role: "Momin", masjidId: req.params.masjidId });
  res.json({ totalMomin: momins.length });
});

// --- Connect Momin to Masjid ---
app.post("/api/connect-masjid", async (req, res) => {
  const { email, masjidId } = req.body;
  if (!email || !masjidId)
    return res.status(400).json({ success: false, message: "Missing email or masjidId" });

  await User.updateOne({ email, role: "Momin" }, { $set: { masjidId } });
  res.json({ success: true });
});

// --- Disconnect Momin from Masjid ---
app.post("/api/disconnect-masjid", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Missing email" });

  await User.updateOne({ email, role: "Momin" }, { $set: { masjidId: null } });
  res.json({ success: true });
});

// --- Register User ---
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, photo, role } = req.body;
    if (!name || !email || !role) return res.status(400).json({ success: false, message: "Missing fields" });

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role !== role) {
        return res.json({
          success: false,
          alreadyRegistered: true,
          registeredRole: existingUser.role,
          message: `This email is already registered as ${existingUser.role}. You cannot register or login as ${role}.`,
        });
      }

      if (role === "Imam") {
        const masjid = await Masjid.findOne({ userEmail: email });
        return res.json({
          success: true,
          alreadyRegistered: true,
          registeredRole: "Imam",
          masjidRegistered: !!masjid,
        });
      } else {
        return res.json({
          success: true,
          alreadyRegistered: true,
          registeredRole: "Momin",
        });
      }
    }

    // New user
    const newUser = new User({ name, email, photo, role });
    await newUser.save();

    res.json({
      success: true,
      alreadyRegistered: false,
      registeredRole: role,
      masjidRegistered: role === "Imam" ? false : undefined,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Register Masjid ---
app.post("/api/masjid", async (req, res) => {
  try {
    const { userEmail, masjidName, address, city, state, pincode } = req.body;

    if (!userEmail || !masjidName || !address || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const existing = await Masjid.findOne({ userEmail });
    if (existing) {
      return res.json({
        success: false,
        message: "Masjid already registered for this Imam.",
        masjidRegistered: true,
        masjidId: existing.masjidId,
      });
    }

    // Generate unique masjid ID
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

    res.json({ success: true, masjid, masjidRegistered: true, masjidId });
  } catch (err) {
    console.error("Masjid registration error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Register/Update Momin Device ---
app.post("/api/register-device", async (req, res) => {
  const { email, deviceId } = req.body;
  if (!email || !deviceId)
    return res.status(400).json({ success: false, message: "Missing email or deviceId" });

  await User.updateOne({ email, role: "Momin" }, { $set: { deviceId } });
  res.json({ success: true });
});

// --- Get all users ---
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- Get all masjids ---
app.get("/api/masjids", async (req, res) => {
  try {
    const masjids = await Masjid.find();
    res.json(masjids);
  } catch (err) {
    console.error("Fetch masjids error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on http://0.0.0.0:${PORT} 🚀`)
);