const { database } = require("../config/firebase");
const { ref, get, set } = require("firebase/database");
const { decryptData } = require("./encryption");

/**
 * Migration utility to populate challenge indexes for existing challenges
 */

const ENCRYPTION_KEY = process.env.CHALLENGE_ENCRYPTION_KEY || "";

/**
 * Migrate existing challenges to user indexes
 */
const migrateChallengeIndexes = async () => {
  try {
    console.log("🔄 Starting challenge index migration...");
    const startTime = Date.now();

    // Get all existing challenges
    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (!challengesSnap.exists()) {
      console.log("✅ No challenges found to migrate");
      return { migrated: 0, errors: 0 };
    }

    const allChallenges = challengesSnap.val();
    let migrated = 0;
    let errors = 0;

    console.log(
      `📦 Found ${Object.keys(allChallenges).length} challenges to migrate`
    );

    // Process each challenge
    for (const [challengeId, encryptedData] of Object.entries(allChallenges)) {
      try {
        // Decrypt challenge data
        const challengeData = decryptData(encryptedData, ENCRYPTION_KEY);

        // Add to challenger's index
        const challengerRef = ref(
          database,
          `userChallenges/${challengeData.challengerId}/${challengeId}`
        );
        await set(challengerRef, {
          challengeId,
          status: challengeData.status,
          role: "challenger",
          createdAt: challengeData.createdAt,
          updatedAt: Date.now(),
        });

        // Add to challenged user's index
        const challengedRef = ref(
          database,
          `userChallenges/${challengeData.challengedId}/${challengeId}`
        );
        await set(challengedRef, {
          challengeId,
          status: challengeData.status,
          role: "challenged",
          createdAt: challengeData.createdAt,
          updatedAt: Date.now(),
        });

        migrated++;
        console.log(
          `✅ Migrated challenge ${challengeId} (${challengeData.status})`
        );
      } catch (error) {
        errors++;
        console.warn(
          `❌ Failed to migrate challenge ${challengeId}:`,
          error.message
        );
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`🎉 Migration completed in ${elapsed}ms`);
    console.log(`📊 Results: ${migrated} migrated, ${errors} errors`);

    return { migrated, errors };
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
};

/**
 * Check if migration is needed
 */
const checkMigrationStatus = async () => {
  try {
    // Check if any user challenges exist
    const userChallengesRef = ref(database, "userChallenges");
    const userChallengesSnap = await get(userChallengesRef);

    if (!userChallengesSnap.exists()) {
      return { needsMigration: true, reason: "No user challenges index found" };
    }

    const userChallenges = userChallengesSnap.val();
    const userCount = Object.keys(userChallenges).length;

    // Check if we have challenges but no indexes
    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (challengesSnap.exists()) {
      const challengeCount = Object.keys(challengesSnap.val()).length;
      if (challengeCount > 0 && userCount === 0) {
        return {
          needsMigration: true,
          reason: "Challenges exist but no indexes found",
        };
      }
    }

    return {
      needsMigration: false,
      userCount,
      challengeCount: challengesSnap.exists()
        ? Object.keys(challengesSnap.val()).length
        : 0,
    };
  } catch (error) {
    console.error("Error checking migration status:", error);
    return { needsMigration: true, reason: "Error checking status" };
  }
};

module.exports = {
  migrateChallengeIndexes,
  checkMigrationStatus,
};
