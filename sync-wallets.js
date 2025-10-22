// Sync user wallets from JSON database to Firebase Realtime Database
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Load Firebase Admin SDK credentials
const serviceAccountPath = path.join(__dirname, 'firebase-adminsdk.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Load database JSON
const dbJsonPath = path.join(__dirname, '../firebase-gamtribe-db.json');
const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://gametibe2025-default-rtdb.firebaseio.com'
});

const db = admin.database();

// Users to sync (add more as needed)
const usersToSync = [
  'VkCTp1obYaXWrxXNa2GdbbyV5q33', // Geoffrey Erastus
  'XGRmAbJSRqNavfD2DWVXhur5xmi2', // Brian Kimathi
];

async function syncUserWallet(userId) {
  try {
    console.log(`\n🔄 Syncing wallet for user: ${userId}`);
    
    // Get user data from JSON database
    const userDataFromJson = dbData.users?.[userId];
    
    if (!userDataFromJson) {
      console.error(`❌ User ${userId} not found in JSON database`);
      return false;
    }

    console.log(`📋 User: ${userDataFromJson.username || userDataFromJson.email}`);
    console.log(`   Email: ${userDataFromJson.email}`);
    console.log(`   Points: ${userDataFromJson.points}`);
    
    const walletFromJson = userDataFromJson.wallet || {};
    
    if (!walletFromJson.amount && !walletFromJson.escrowBalance) {
      console.log(`⚠️  No wallet data found for this user`);
      return false;
    }

    // Prepare wallet data
    const walletData = {
      amount: walletFromJson.amount || 0,
      escrowBalance: walletFromJson.escrowBalance || 0,
      currency: walletFromJson.currency || 'KES',
      lastUpdated: Date.now()
    };

    // Include lastTransaction if it exists
    if (walletFromJson.lastTransaction) {
      walletData.lastTransaction = walletFromJson.lastTransaction;
    }

    console.log(`💰 Wallet data:`);
    console.log(`   Available: ${walletData.amount} ${walletData.currency}`);
    console.log(`   Escrow: ${walletData.escrowBalance} ${walletData.currency}`);
    console.log(`   Total: ${walletData.amount + walletData.escrowBalance} ${walletData.currency}`);

    // Sync to Firebase Realtime Database
    const userRef = db.ref(`users/${userId}/wallet`);
    await userRef.set(walletData);
    
    console.log(`✅ Wallet synced successfully!`);
    return true;
  } catch (error) {
    console.error(`❌ Error syncing wallet for ${userId}:`, error.message);
    return false;
  }
}

async function syncAllWallets() {
  console.log('🚀 Starting wallet synchronization...');
  console.log(`📦 Syncing ${usersToSync.length} users\n`);
  
  let successCount = 0;
  let failCount = 0;

  for (const userId of usersToSync) {
    const success = await syncUserWallet(userId);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Sync Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📋 Total: ${usersToSync.length}`);
  console.log('='.repeat(50));

  process.exit(successCount === usersToSync.length ? 0 : 1);
}

// Run the sync
syncAllWallets();


