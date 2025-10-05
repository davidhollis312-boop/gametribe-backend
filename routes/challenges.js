const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  createChallenge,
  acceptChallenge,
  rejectChallenge,
  submitChallengeScore,
  getChallengeHistory,
} = require("../controllers/challengeController");
const {
  validateChallengeRequest,
  validateScoreSubmission,
  validateWalletBalance,
  antiFraudCheck,
  checkChallengeExpiration,
} = require("../middleware/challengeValidator");

/**
 * Challenge Routes
 * All routes require authentication
 */

// Create a new challenge
router.post(
  "/create",
  authenticateToken,
  antiFraudCheck,
  validateChallengeRequest,
  validateWalletBalance,
  createChallenge
);

// Accept a challenge
router.post(
  "/accept/:challengeId",
  authenticateToken,
  antiFraudCheck,
  checkChallengeExpiration,
  acceptChallenge
);

// Reject a challenge
router.post(
  "/reject/:challengeId",
  authenticateToken,
  antiFraudCheck,
  checkChallengeExpiration,
  rejectChallenge
);

// Submit challenge score
router.post(
  "/score",
  authenticateToken,
  antiFraudCheck,
  validateScoreSubmission,
  submitChallengeScore
);

// Get user's challenge history
router.get("/history", authenticateToken, getChallengeHistory);

// Get specific challenge details (for participants only)
router.get("/:challengeId", authenticateToken, async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.uid;

    // Import challenge controller functions
    const { database } = require("../config/firebase");
    const { ref, get } = require("firebase/database");
    const { decryptData } = require("../utils/encryption");

    const ENCRYPTION_KEY =
      process.env.CHALLENGE_ENCRYPTION_KEY ||
      "your-32-character-secret-key-here!";

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate user can view this challenge
    if (
      challengeData.challengerId !== userId &&
      challengeData.challengedId !== userId
    ) {
      return res
        .status(403)
        .json({ error: "Unauthorized: You cannot view this challenge" });
    }

    // Return safe challenge data
    const safeChallengeData = {
      challengeId: challengeData.challengeId,
      gameTitle: challengeData.gameTitle,
      gameImage: challengeData.gameImage,
      betAmount: challengeData.betAmount,
      status: challengeData.status,
      createdAt: challengeData.createdAt,
      expiresAt: challengeData.expiresAt,
      acceptedAt: challengeData.acceptedAt,
      completedAt: challengeData.completedAt,
      challengerScore: challengeData.challengerScore,
      challengedScore: challengeData.challengedScore,
      winnerId: challengeData.winnerId,
      serviceCharge: challengeData.serviceCharge,
      totalPrize: challengeData.totalPrize,
      netPrize: challengeData.netPrize,
      isChallenger: challengeData.challengerId === userId,
      opponentId:
        challengeData.challengerId === userId
          ? challengeData.challengedId
          : challengeData.challengerId,
    };

    res.json({
      success: true,
      challenge: safeChallengeData,
    });
  } catch (error) {
    console.error("Error getting challenge details:", error);
    res.status(500).json({
      error: "Failed to get challenge details",
      message: error.message,
    });
  }
});

// Cancel a challenge (only challenger can cancel before acceptance)
router.delete(
  "/:challengeId",
  authenticateToken,
  antiFraudCheck,
  async (req, res) => {
    try {
      const { challengeId } = req.params;
      const userId = req.user.uid;

      // Import required modules
      const { database } = require("../config/firebase");
      const { ref, get, remove, update } = require("firebase/database");
      const { decryptData, encryptData } = require("../utils/encryption");

      const ENCRYPTION_KEY =
        process.env.CHALLENGE_ENCRYPTION_KEY ||
        "your-32-character-secret-key-here!";

      // Get encrypted challenge data
      const challengeRef = ref(database, `secureChallenges/${challengeId}`);
      const challengeSnap = await get(challengeRef);

      if (!challengeSnap.exists()) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // Decrypt challenge data
      const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

      // Validate user can cancel this challenge
      if (challengeData.challengerId !== userId) {
        return res.status(403).json({
          error: "Unauthorized: Only the challenger can cancel this challenge",
        });
      }

      if (challengeData.status !== "pending") {
        return res
          .status(400)
          .json({ error: "Challenge cannot be cancelled after acceptance" });
      }

      // Check if challenge has expired
      if (Date.now() > challengeData.expiresAt) {
        return res.status(400).json({ error: "Challenge has already expired" });
      }

      // Refund challenger (minus service charge)
      const serviceCharge = Math.round(challengeData.betAmount * (20 / 100));
      const refundAmount = challengeData.betAmount - serviceCharge;

      // Get challenger's wallet
      const challengerUserRef = ref(database, `users/${userId}`);
      const challengerUserSnap = await get(challengerUserRef);
      const challengerUser = challengerUserSnap.val();
      const challengerWallet = challengerUser.wallet || {};

      // Refund challenger
      const challengerWalletUpdates = {
        amount: (challengerWallet.amount || 0) + refundAmount,
        escrowBalance:
          (challengerWallet.escrowBalance || 0) - challengeData.betAmount,
        lastTransaction: {
          type: "challenge_cancelled_refund",
          amount: refundAmount,
          serviceCharge,
          challengeId,
          timestamp: Date.now(),
        },
      };

      // Update challenge status
      const updatedChallengeData = {
        ...challengeData,
        status: "cancelled",
        cancelledAt: Date.now(),
        refundAmount,
        serviceCharge,
      };

      const encryptedUpdatedChallenge = encryptData(
        updatedChallengeData,
        ENCRYPTION_KEY
      );

      // Update challenge and wallet
      await update(challengeRef, encryptedUpdatedChallenge);
      await update(challengerUserRef, {
        wallet: {
          ...challengerWallet,
          ...challengerWalletUpdates,
        },
      });

      // Remove challenge notification for challenged user
      const notificationRef = ref(
        database,
        `notifications/${challengeData.challengedId}`
      );
      const notificationSnap = await get(notificationRef);

      if (notificationSnap.exists()) {
        const notifications = notificationSnap.val();
        const challengeNotification = Object.keys(notifications).find(
          (key) => notifications[key].challengeId === challengeId
        );

        if (challengeNotification) {
          await remove(
            ref(
              database,
              `notifications/${challengeData.challengedId}/${challengeNotification}`
            )
          );
        }
      }

      // Log transaction for audit
      const auditLog = {
        challengeId,
        type: "challenge_cancelled",
        userId,
        amount: challengeData.betAmount,
        refundAmount,
        serviceCharge,
        timestamp: Date.now(),
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      };

      const auditRef = ref(database, `auditLogs/challenges/${challengeId}`);
      await update(auditRef, auditLog);

      res.json({
        success: true,
        message: "Challenge cancelled successfully",
        data: {
          challengeId,
          refundAmount,
          serviceCharge,
        },
      });
    } catch (error) {
      console.error("Error cancelling challenge:", error);
      res.status(500).json({
        error: "Failed to cancel challenge",
        message: error.message,
      });
    }
  }
);

module.exports = router;
