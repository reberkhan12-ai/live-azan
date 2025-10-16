const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH), "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;

