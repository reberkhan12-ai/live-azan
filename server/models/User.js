const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  photo: String,
  role: { type: String, enum: ["Imam", "Momin"] },
  masjidId: { type: String, default: null },
  deviceId: { type: String, default: null },
});

module.exports = mongoose.model("User", userSchema);
