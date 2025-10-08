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

      // Validate user is a participant in this challenge
      const isChallenger = challengeData.challengerId === userId;
      const isChallenged = challengeData.challengedId === userId;

      if (!isChallenger && !isChallenged) {
        return res.status(403).json({
          error: "Unauthorized: You are not a participant in this challenge",
        });
      }

      // Can cancel if: pending (challenger only) or accepted (both can cancel)
      if (challengeData.status === "pending" && !isChallenger) {
        return res.status(403).json({
          error: "Only the challenger can cancel a pending challenge",
        });
      }

      if (
        challengeData.status !== "pending" &&
        challengeData.status !== "accepted"
      ) {
        return res.status(400).json({
          error: `Cannot cancel challenge with status: ${challengeData.status}`,
        });
      }

      // Check if challenge has expired - if so, process as expired instead of cancelled
      const hasExpired = Date.now() > challengeData.expiresAt;
      const isExpiration = hasExpired && challengeData.status === "pending";

      // Refund with 4% fee (96% refund) - same for both cancellation and expiration
      const fee = Math.round(challengeData.betAmount * (4 / 100));
      const refundAmount = challengeData.betAmount - fee;

      // For accepted challenges, refund both users. For pending/expired, refund challenger only
      const usersToRefund =
        challengeData.status === "accepted"
          ? [challengeData.challengerId, challengeData.challengedId]
          : [challengeData.challengerId];

      // Refund all applicable users
      for (const userIdToRefund of usersToRefund) {
        const userRef = ref(database, `users/${userIdToRefund}`);
        const userSnap = await get(userRef);
        const userData = userSnap.val();
        const userWallet = userData.wallet || {};

        const walletUpdates = {
          amount: (userWallet.amount || 0) + refundAmount,
          escrowBalance:
            (userWallet.escrowBalance || 0) - challengeData.betAmount,
          lastTransaction: {
            type: isExpiration ? "challenge_expired_refund" : "challenge_cancelled_refund",
            amount: refundAmount,
            fee: fee,
            challengeId,
            timestamp: Date.now(),
          },
          updatedAt: new Date().toISOString(),
        };

        await update(userRef, {
          wallet: {
            ...userWallet,
            ...walletUpdates,
          },
        });
      }

      // Update challenge status - mark as expired if it has expired, otherwise cancelled
      const updatedChallengeData = {
        ...challengeData,
        status: isExpiration ? "expired" : "cancelled",
        cancelledBy: userId,
        cancelledAt: Date.now(),
        refundAmount,
        cancellationFee: fee,
        ...(isExpiration && { expiredAt: Date.now() }),
      };

      const encryptedUpdatedChallenge = encryptData(
        updatedChallengeData,
        ENCRYPTION_KEY
      );

      // Update challenge in database
      await update(challengeRef, encryptedUpdatedChallenge);

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
        type: isExpiration ? "challenge_expired" : "challenge_cancelled",
        userId,
        cancelledBy: userId,
        challengeStatus: challengeData.status,
        amount: challengeData.betAmount,
        refundAmount,
        cancellationFee: fee,
        usersRefunded: usersToRefund.length,
        isExpiration,
        timestamp: Date.now(),
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      };

      const auditRef = ref(database, `auditLogs/challenges/${challengeId}`);
      await update(auditRef, auditLog);

      const message = isExpiration
        ? `Challenge expired. Refunded ${refundAmount} shillings (4% expiration fee applied).`
        : `Challenge cancelled successfully. Refunded ${refundAmount} shillings (4% cancellation fee applied).`;

      res.json({
        success: true,
        message,
        data: {
          challengeId,
          refundAmount,
          cancellationFee: fee,
          originalAmount: challengeData.betAmount,
          usersRefunded: usersToRefund.length,
          isExpiration,
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
