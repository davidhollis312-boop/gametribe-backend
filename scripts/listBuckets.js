#!/usr/bin/env node

const admin = require("firebase-admin");
const serviceAccount = require("../config/firebase-adminsdk.json");

(async () => {
  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    const storage = admin.storage();
    const appBucket = admin.app().options.storageBucket || "<none>";
    console.log("App storageBucket:", appBucket);

    const [buckets] = await storage.getBuckets();
    console.log("Accessible buckets:");
    for (const b of buckets) {
      console.log("-", b.name);
    }
  } catch (err) {
    console.error("Failed to list buckets:", err.message);
    process.exit(1);
  }
})();

