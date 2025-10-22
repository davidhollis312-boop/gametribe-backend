/**
 * Challenge Cleanup Service
 * Handles automatic expiration of old challenges
 */

const { database } = require("../config/firebase");
const { ref, get, update } = require("firebase/database");
const { encryptData, decryptData } = require("../utils/encryption");
const admin = require("firebase-admin");

const ENCRYPTION_KEY = process.env.CHALLENGE_ENCRYPTION_KEY;

/**
 * Expire a single challenge and refund challenger
 */
const expireChallenge = async (challengeId, challengeData) => {
  try {
    console.log(`⏰ Expiring challenge: ${challengeId}`);

    // Calculate refund with 4% expiration fee
    const expirationFee = Math.round(challengeData.betAmount * 0.04);
    const refundAmount = challengeData.betAmount - expirationFee;

    // Refund challenger atomically
    const challengerWalletRef = admin
      .database()
      .ref(`users/${challengeData.challengerId}/wallet`);

    await challengerWalletRef.transaction((wallet) => {
      if (!wallet) return wallet;

      // Verify escrow
      const currentEscrow = wallet.escrowBalance || 0;
      if (currentEscrow < challengeData.betAmount) {
        console.warn(
          `⚠️ Escrow mismatch on expiration: ${currentEscrow} < ${challengeData.betAmount}`
        );
      }

      // Refund with fee deduction
      wallet.amount = (wallet.amount || 0) + refundAmount;
      wallet.escrowBalance = Math.max(
        0,
        currentEscrow - challengeData.betAmount
      );
      wallet.lastTransaction = {
        type: "challenge_expired_refund",
        amount: refundAmount,
        expirationFee,
        challengeId,
        timestamp: Date.now(),
      };
      wallet.updatedAt = new Date().toISOString();

      return wallet;
    });

    // Update challenge status
    const expiredChallengeData = {
      ...challengeData,
      status: "expired",
      expiredAt: Date.now(),
      refundAmount,
      expirationFee,
    };

    const encryptedExpiredChallenge = encryptData(
      expiredChallengeData,
      ENCRYPTION_KEY
    );

    // Update challenge
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    await update(challengeRef, encryptedExpiredChallenge);

    console.log(
      `✅ Challenge ${challengeId} expired, refunded ${refundAmount} KES to challenger`
    );

    return {
      success: true,
      challengeId,
      refundAmount,
      expirationFee,
    };
  } catch (error) {
    console.error(`❌ Error expiring challenge ${challengeId}:`, error);
    throw error;
  }
};

/**
 * Run cleanup job to expire old challenges
 */
const runCleanupJob = async () => {
  try {
    console.log("🧹 Starting challenge cleanup job...");
    const startTime = Date.now();

    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (!challengesSnap.exists()) {
      console.log("✅ No challenges to clean up");
      return { expiredCount: 0 };
    }

    const allChallenges = challengesSnap.val();
    const now = Date.now();
    let expiredCount = 0;
    const errors = [];

    for (const [challengeId, encryptedData] of Object.entries(allChallenges)) {
      try {
        const challengeData = decryptData(encryptedData, ENCRYPTION_KEY);

        // Check if challenge is pending and expired
        if (
          challengeData.status === "pending" &&
          now > challengeData.expiresAt
        ) {
          await expireChallenge(challengeId, challengeData);
          expiredCount++;
        }

        // Also check for stuck "accepted" challenges (>7 days old)
        if (
          challengeData.status === "accepted" &&
          challengeData.acceptedAt &&
          now - challengeData.acceptedAt > 7 * 24 * 60 * 60 * 1000 // 7 days
        ) {
          console.log(
            `⚠️ Found stuck challenge (7+ days in accepted state): ${challengeId}`
          );
          // Log for manual review
          const stuckRef = ref(database, `stuckChallenges/${challengeId}`);
          await update(stuckRef, {
            challengeId,
            status: challengeData.status,
            acceptedAt: challengeData.acceptedAt,
            age: now - challengeData.acceptedAt,
            flaggedAt: now,
          });
        }
      } catch (decryptError) {
        console.warn(
          `Failed to process challenge ${challengeId}:`,
          decryptError.message
        );
        errors.push({ challengeId, error: decryptError.message });
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `✅ Cleanup job completed in ${elapsed}ms: ${expiredCount} challenges expired`
    );

    return {
      success: true,
      expiredCount,
      errors: errors.length > 0 ? errors : undefined,
      duration: elapsed,
    };
  } catch (error) {
    console.error("❌ Cleanup job failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Start scheduled cleanup job (runs every hour)
 */
const startCleanupSchedule = () => {
  const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

  console.log("🕐 Starting challenge cleanup schedule (every 1 hour)");

  // Run immediately on startup
  runCleanupJob();

  // Then run every hour
  setInterval(runCleanupJob, CLEANUP_INTERVAL);
};

module.exports = {
  expireChallenge,
  runCleanupJob,
  startCleanupSchedule,
};
