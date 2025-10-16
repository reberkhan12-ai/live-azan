const mongoose = require("mongoose");

const masjidSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  masjidName: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  masjidId: { type: String, unique: true },
});

module.exports = mongoose.model("Masjid", masjidSchema);
