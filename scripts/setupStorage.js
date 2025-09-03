#!/usr/bin/env node

/**
 * Firebase Storage Setup Script
 * 
 * This script helps you set up Firebase Storage bucket for your project.
 * Run this script to check and create the storage bucket if needed.
 */

const admin = require("firebase-admin");
const serviceAccount = require("../config/firebase-adminsdk.json");
const { STORAGE_CONFIG } = require("../config/storageConfig");

const BUCKET_NAME = STORAGE_CONFIG.getBucketName();

async function setupStorage() {
  try {
    console.log("🚀 Setting up Firebase Storage...");
    
    // Initialize Firebase Admin
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: BUCKET_NAME,
    });

    const storage = admin.storage();
    
    // Check if bucket exists
    console.log(`🔍 Checking if bucket '${BUCKET_NAME}' exists...`);
    
    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const [exists] = await bucket.exists();
      
      if (exists) {
        console.log("✅ Storage bucket already exists!");
        
        // Test bucket access
        try {
          await bucket.getMetadata();
          console.log("✅ Bucket is accessible and ready to use");
        } catch (error) {
          console.error("❌ Bucket exists but is not accessible:", error.message);
          console.log("💡 Make sure your service account has Storage Admin permissions");
        }
      } else {
        console.log("❌ Storage bucket does not exist");
        console.log("💡 You need to create the bucket in Firebase Console:");
        console.log(`   1. Go to https://console.firebase.google.com/`);
        console.log(`   2. Select your project: gametibe2025`);
        console.log(`   3. Go to Storage section`);
        console.log(`   4. Create a bucket named: ${BUCKET_NAME}`);
        console.log(`   5. Set the location to your preferred region`);
        console.log(`   6. Make sure your service account has Storage Admin role`);
      }
    } catch (error) {
      console.error("❌ Error checking bucket:", error.message);
      
      if (error.code === 404) {
        console.log("💡 Bucket not found. Create it in Firebase Console:");
        console.log(`   https://console.firebase.google.com/project/gametibe2025/storage`);
      } else if (error.code === 403) {
        console.log("💡 Permission denied. Check your service account permissions:");
        console.log("   - Go to Google Cloud Console");
        console.log("   - IAM & Admin > IAM");
        console.log("   - Find your service account");
        console.log("   - Add 'Storage Admin' role");
      }
    }
    
    // Test file operations
    console.log("\n🧪 Testing file operations...");
    try {
      const bucket = storage.bucket(BUCKET_NAME);
      const testFile = bucket.file('test-connection.txt');
      
      // Try to upload a test file
      await testFile.save('Test connection from setup script');
      console.log("✅ File upload test successful");
      
      // Clean up test file
      await testFile.delete();
      console.log("✅ File deletion test successful");
      
      console.log("🎉 Storage bucket is fully functional!");
      
    } catch (error) {
      console.error("❌ File operations test failed:", error.message);
      console.log("💡 This might be a permissions issue");
    }
    
  } catch (error) {
    console.error("❌ Setup failed:", error.message);
    console.log("\n🔧 Troubleshooting steps:");
    console.log("1. Verify your firebase-adminsdk.json file is correct");
    console.log("2. Check that your Firebase project exists");
    console.log("3. Ensure your service account has proper permissions");
    console.log("4. Try creating the bucket manually in Firebase Console");
  }
}

// Run the setup
setupStorage().then(() => {
  console.log("\n✨ Setup complete!");
  process.exit(0);
}).catch((error) => {
  console.error("\n💥 Setup failed:", error.message);
  process.exit(1);
});