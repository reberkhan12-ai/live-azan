const express = require("express");
const router = express.Router();
const { verifyFirebaseToken } = require("../middleware/authMiddleware");
const { checkUser } = require("../controllers/authController");

router.post("/check-user", verifyFirebaseToken, checkUser);

module.exports = router;
