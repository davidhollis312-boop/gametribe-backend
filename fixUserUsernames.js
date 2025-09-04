const { database } = require("./config/firebase");

/**
 * Script to fix users who have "User" as their username or missing usernames
 * This will update their usernames to use their email prefix or a proper fallback
 */
async function fixUserUsernames() {
  try {
    console.log('🔍 Starting user username fix...');
    
    const usersRef = database.ref('users');
    const snapshot = await usersRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('❌ No users found');
      return;
    }
    
    const users = snapshot.val();
    const userEntries = Object.entries(users);
    
    console.log(`📊 Found ${userEntries.length} users to check`);
    
    let fixedCount = 0;
    
    for (const [userId, userData] of userEntries) {
      if (!userData.username || userData.username === "User" || userData.username.trim() === "") {
        let newUsername;
        
        // Priority order: email prefix > user ID
        if (userData.email && userData.email.includes('@')) {
          newUsername = userData.email.split("@")[0];
        } else {
          newUsername = `User_${userId.substring(0, 8)}`;
        }
        
        // Update the user's username
        await database.ref(`users/${userId}`).update({ username: newUsername });
        
        console.log(`✅ Fixed user ${userId}: "${userData.username || 'empty'}" → "${newUsername}"`);
        fixedCount++;
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} users out of ${userEntries.length} total users`);
    
  } catch (error) {
    console.error('❌ Error fixing user usernames:', error);
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixUserUsernames()
    .then(() => {
      console.log('✅ Username fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Username fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixUserUsernames };