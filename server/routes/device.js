const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../middleware/authMiddleware");
const { getDevices, registerDevice } = require("../controllers/deviceController");

router.get("/:masjidId", verifyFirebaseToken, getDevices);
router.post("/register", verifyFirebaseToken, registerDevice);

module.exports = router;
