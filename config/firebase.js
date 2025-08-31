const admin = require("firebase-admin");
const serviceAccount = require("../firebase-adminsdk.json");

try {
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gametibe2025-default-rtdb.firebaseio.com",
    storageBucket: "gametibe2025.appspot.com",
  });

  const auth = admin.auth();
  const database = admin.database(); // Realtime Database
  const storage = admin.storage();

  // Note: Removed Firestore since we're using Realtime Database

  module.exports = { auth, storage, database };
} catch (error) {
  console.error("config/firebase.js - Error initializing Firebase Admin SDK:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
  throw error;
}
