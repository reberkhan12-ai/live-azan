const admin = require("../firebaseAdmin");

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // uid, email, name
    next();
  } catch (err) {
    console.error("Firebase token error:", err);
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = { verifyFirebaseToken };
