const express = require('express');
const router = express.Router();
const { getMasjidDebug } = require('../controllers/adminController');

// GET /api/admin/masjid/:masjidId
router.get('/masjid/:masjidId', getMasjidDebug);

module.exports = router;
