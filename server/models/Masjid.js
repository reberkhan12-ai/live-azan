const mongoose = require("mongoose");

const masjidSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  masjidName: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  masjidId: { type: String, unique: true },
  // list of registered device IDs (esp32 devices)
  devices: { type: [String], default: [] },
});

module.exports = mongoose.model("Masjid", masjidSchema);
