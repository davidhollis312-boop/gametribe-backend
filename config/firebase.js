const admin = require("firebase-admin");
const { initializeStorage, storageUtils } = require("./storageConfig");

// Use environment variables for Firebase Admin SDK credentials (ONLY from .env)
let serviceAccount;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log("✅ Loaded service account from .env");
  } else {
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_JSON not set in .env");
    serviceAccount = undefined;
  }
} catch (error) {
  console.error(
    "❌ Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:",
    error.message
  );
  serviceAccount = undefined;
}

try {
  const appConfig = {
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      "https://gametibe2025-default-rtdb.firebaseio.com",
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      "gasometibe2025.firebasestorage.app",
  };

  // Only add credential if serviceAccount is available
  if (serviceAccount) {
    appConfig.credential = admin.credential.cert(serviceAccount);
  }

  const app = admin.initializeApp(appConfig);

  const auth = admin.auth();
  const database = admin.database(); // Realtime Database

  // Initialize storage with error handling
  const storageBucket = initializeStorage();

  // Create storage object with bucket method
  const storage = {
    bucket: () => storageBucket,
    uploadFile: (file, destination) =>
      storageUtils.uploadFile(storageBucket, file, destination),
    deleteFile: (fileName) => storageUtils.deleteFile(storageBucket, fileName),
    getSignedUrl: (fileName, options) =>
      storageUtils.getSignedUrl(storageBucket, fileName, options),
    isAvailable: () => storageUtils.isStorageAvailable(storageBucket),
  };

  console.log("✅ Firebase Admin SDK initialized successfully");
  console.log(
    `📊 Database URL: https://gametibe2025-default-rtdb.firebaseio.com`
  );
  console.log(`🪣 Storage available: ${storage.isAvailable()}`);

  module.exports = { auth, storage, database };
} catch (error) {
  console.error(
    "❌ config/firebase.js - Error initializing Firebase Admin SDK:",
    {
      message: error.message,
      code: error.code,
      stack: error.stack,
    }
  );

  // Initialize with minimal functionality for graceful degradation
  const auth = admin.auth();
  const database = admin.database();
  const storage = {
    bucket: () => {
      throw new Error("Firebase not initialized");
    },
    uploadFile: () => Promise.reject(new Error("Firebase not initialized")),
    deleteFile: () => Promise.resolve(),
    getSignedUrl: () => Promise.reject(new Error("Firebase not initialized")),
    isAvailable: () => false,
  };

  console.warn(
    "⚠️ Firebase initialized in degraded mode - some features may not work"
  );
  module.exports = { auth, storage, database };
}
