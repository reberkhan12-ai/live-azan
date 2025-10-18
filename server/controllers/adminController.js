const Masjid = require('../models/Masjid');

// Return masjid DB info and live websocket online devices
const getMasjidDebug = async (req, res) => {
  try {
    const { masjidId } = req.params;
    if (!masjidId) return res.status(400).json({ success: false, message: 'masjidId required' });

    const masjid = await Masjid.findOne({ masjidId }).lean();
    if (!masjid) return res.status(404).json({ success: false, message: 'Masjid not found' });

    const getStatus = req.app.locals.getMasjidStatus;
    const online = getStatus ? getStatus(masjidId) : [];

    res.json({ success: true, masjid, onlineDevices: online });
  } catch (err) {
    console.error('Admin getMasjidDebug error', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getMasjidDebug };