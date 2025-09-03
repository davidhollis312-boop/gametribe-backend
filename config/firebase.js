const admin = require("firebase-admin");
const serviceAccount = require("../firebase-adminsdk.json");
const { initializeStorage, storageUtils } = require("./storageConfig");

try {
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://gametibe2025-default-rtdb.firebaseio.com",
    storageBucket: "gametibe2025.appspot.com",
  });

  const auth = admin.auth();
  const database = admin.database(); // Realtime Database
  
  // Initialize storage with error handling
  const storage = initializeStorage();
  
  // Add utility methods to storage object
  storage.uploadFile = (file, destination) => storageUtils.uploadFile(storage, file, destination);
  storage.deleteFile = (fileName) => storageUtils.deleteFile(storage, fileName);
  storage.getSignedUrl = (fileName, options) => storageUtils.getSignedUrl(storage, fileName, options);
  storage.isAvailable = () => storageUtils.isStorageAvailable(storage);

  console.log("✅ Firebase Admin SDK initialized successfully");
  console.log(`📊 Database URL: https://gametibe2025-default-rtdb.firebaseio.com`);
  console.log(`🪣 Storage available: ${storage.isAvailable()}`);

  module.exports = { auth, storage, database };
} catch (error) {
  console.error("❌ config/firebase.js - Error initializing Firebase Admin SDK:", {
    message: error.message,
    code: error.code,
    stack: error.stack,
  });
  
  // Initialize with minimal functionality for graceful degradation
  const auth = admin.auth();
  const database = admin.database();
  const storage = {
    uploadFile: () => Promise.reject(new Error('Firebase not initialized')),
    deleteFile: () => Promise.resolve(),
    getSignedUrl: () => Promise.reject(new Error('Firebase not initialized')),
    isAvailable: () => false
  };
  
  console.warn("⚠️ Firebase initialized in degraded mode - some features may not work");
  module.exports = { auth, storage, database };
}
