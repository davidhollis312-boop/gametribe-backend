const crypto = require("crypto");
const { database } = require("../config/firebase");
const {
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue,
  off,
} = require("firebase/database");
const {
  validateChallengeRequest,
} = require("../middleware/challengeValidator");
const {
  encryptData,
  decryptData,
  generateChallengeId,
} = require("../utils/encryption");

/**
 * Secure Challenge Controller
 * Handles encrypted monetized challenges with wallet integration
 */

// Encryption key (should be in environment variables in production)
const ENCRYPTION_KEY =
  process.env.CHALLENGE_ENCRYPTION_KEY || "your-32-character-secret-key-here!";
const SERVICE_CHARGE_PERCENTAGE = 20; // 20% service charge
const MINIMUM_BET_AMOUNT = 20; // 20 shillings minimum

/**
 * Create a secure challenge
 */
const createChallenge = async (req, res) => {
  try {
    const {
      challengerId,
      challengedId,
      gameId,
      betAmount,
      gameTitle,
      gameImage,
    } = req.body;
    const userId = req.user.uid;

    // Validate request
    if (userId !== challengerId) {
      return res.status(403).json({
        error: "Unauthorized: You can only create challenges for yourself",
      });
    }

    // Validate bet amount
    if (betAmount < MINIMUM_BET_AMOUNT) {
      return res.status(400).json({
        error: `Minimum bet amount is ${MINIMUM_BET_AMOUNT} shillings`,
      });
    }

    // Check challenger's wallet balance (using existing structure: users/{userId}/wallet)
    const challengerUserRef = ref(database, `users/${challengerId}`);
    const challengerUserSnap = await get(challengerUserRef);
    const challengerUser = challengerUserSnap.val();

    if (!challengerUser) {
      return res.status(404).json({ error: "Challenger user not found" });
    }

    const challengerWallet = challengerUser.wallet;
    const challengerBalance =
      challengerWallet?.amount || challengerUser.points || 0;

    if (challengerBalance < betAmount) {
      return res.status(400).json({
        error: "Insufficient wallet balance",
      });
    }

    // Check if challenged user exists and has wallet
    const challengedUserRef = ref(database, `users/${challengedId}`);
    const challengedUserSnap = await get(challengedUserRef);
    const challengedUser = challengedUserSnap.val();

    if (!challengedUser) {
      return res.status(404).json({ error: "Challenged user not found" });
    }

    const challengedWallet = challengedUser.wallet;
    const challengedBalance =
      challengedWallet?.amount || challengedUser.points || 0;

    if (challengedBalance < betAmount) {
      return res.status(400).json({
        error: "Challenged user has insufficient wallet balance",
      });
    }

    // Check for existing active challenges between the same users for the same game
    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (challengesSnap.exists()) {
      const allChallenges = challengesSnap.val();

      for (const [existingChallengeId, encryptedData] of Object.entries(
        allChallenges
      )) {
        try {
          const existingChallenge = decryptData(encryptedData, ENCRYPTION_KEY);

          const isSameGame = existingChallenge.gameId === gameId;
          const isSameUsers =
            (existingChallenge.challengerId === challengerId &&
              existingChallenge.challengedId === challengedId) ||
            (existingChallenge.challengerId === challengedId &&
              existingChallenge.challengedId === challengerId);
          const isActive =
            existingChallenge.status === "pending" ||
            existingChallenge.status === "accepted";

          if (isSameGame && isSameUsers && isActive) {
            return res.status(400).json({
              error:
                "An active challenge already exists between these users for this game",
              message:
                "Please complete or cancel the existing challenge before creating a new one",
            });
          }
        } catch (decryptError) {
          console.warn(
            `Failed to decrypt challenge ${existingChallengeId}:`,
            decryptError
          );
          // Continue checking other challenges
        }
      }
    }

    // Generate secure challenge ID
    const challengeId = generateChallengeId();

    // Create encrypted challenge data
    const challengeData = {
      challengeId,
      challengerId,
      challengedId,
      gameId,
      gameTitle,
      gameImage,
      betAmount,
      status: "pending", // pending, accepted, completed, rejected, cancelled
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      challengerScore: null,
      challengedScore: null,
      winnerId: null,
      serviceCharge: Math.round(betAmount * (SERVICE_CHARGE_PERCENTAGE / 100)),
      totalPrize: betAmount * 2, // Total amount to be won
      netPrize:
        betAmount * 2 -
        Math.round(betAmount * (SERVICE_CHARGE_PERCENTAGE / 100)),
    };

    // Encrypt sensitive challenge data
    const encryptedChallengeData = encryptData(challengeData, ENCRYPTION_KEY);

    // Deduct bet amount from challenger's wallet (hold in escrow)
    const challengerWalletUpdates = {
      amount: challengerBalance - betAmount,
      escrowBalance: (challengerWallet?.escrowBalance || 0) + betAmount,
      lastTransaction: {
        type: "challenge_bet",
        amount: betAmount,
        challengeId,
        timestamp: Date.now(),
      },
    };

    // Store encrypted challenge
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    await set(challengeRef, encryptedChallengeData);

    // Update challenger's wallet in user document
    await update(challengerUserRef, {
      wallet: {
        ...challengerWallet,
        ...challengerWalletUpdates,
      },
    });

    // Create notification for challenged user
    const notificationData = {
      id: `notif_${Date.now()}`,
      type: "challenge_request",
      challengeId,
      fromUserId: challengerId,
      fromUserName: req.user.displayName || req.user.email?.split("@")[0],
      fromUserAvatar: req.user.photoURL || "",
      gameTitle,
      betAmount,
      timestamp: Date.now(),
      read: false,
    };

    const notificationRef = ref(
      database,
      `notifications/${challengedId}/${notificationData.id}`
    );
    await set(notificationRef, notificationData);

    // Log transaction for audit
    const auditLog = {
      challengeId,
      type: "challenge_created",
      userId: challengerId,
      amount: betAmount,
      timestamp: Date.now(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const auditRef = ref(database, `auditLogs/challenges/${challengeId}`);
    await set(auditRef, auditLog);

    res.json({
      success: true,
      challengeId,
      message: "Challenge created successfully",
      data: {
        challengeId,
        betAmount,
        gameTitle,
        challengedUserName:
          challengedUser.displayName || challengedUser.email?.split("@")[0],
      },
    });
  } catch (error) {
    console.error("Error creating challenge:", error);
    res.status(500).json({
      error: "Failed to create challenge",
      message: error.message,
    });
  }
};

/**
 * Accept a challenge
 */
const acceptChallenge = async (req, res) => {
  try {
    const challengeId = req.params.challengeId;
    const userId = req.user.uid;

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate user can accept this challenge
    if (challengeData.challengedId !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized: You cannot accept this challenge" });
    }

    if (challengeData.status !== "pending") {
      return res.status(400).json({ error: "Challenge is no longer pending" });
    }

    // Check if challenge has expired - auto-process expiration if so
    if (Date.now() > challengeData.expiresAt) {
      console.log(
        `⏰ Challenge ${challengeId} has expired, processing expiration...`
      );

      // Calculate refund with 4% expiration fee
      const expirationFee = Math.round(challengeData.betAmount * 0.04);
      const refundAmount = challengeData.betAmount - expirationFee;

      // Get challenger's wallet
      const challengerUserRef = ref(
        database,
        `users/${challengeData.challengerId}`
      );
      const challengerUserSnap = await get(challengerUserRef);
      const challengerUser = challengerUserSnap.val();
      const challengerWallet = challengerUser.wallet || {};

      // Refund challenger (minus 4% fee)
      const walletUpdates = {
        amount: (challengerWallet.amount || 0) + refundAmount,
        escrowBalance:
          (challengerWallet.escrowBalance || 0) - challengeData.betAmount,
        lastTransaction: {
          type: "challenge_expired_refund",
          amount: refundAmount,
          expirationFee,
          challengeId,
          timestamp: Date.now(),
        },
        updatedAt: new Date().toISOString(),
      };

      // Update challenge status to expired
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

      // Update both challenge and wallet
      await update(challengeRef, encryptedExpiredChallenge);
      await update(challengerUserRef, {
        wallet: {
          ...challengerWallet,
          ...walletUpdates,
        },
      });

      console.log(
        `✅ Challenge ${challengeId} marked as expired, refunded ${refundAmount} shillings`
      );

      return res.status(400).json({
        error: "Challenge has expired",
        refundAmount,
        expirationFee,
        message: `Challenge expired. ${refundAmount} shillings refunded (4% expiration fee applied).`,
      });
    }

    // Check challenged user's wallet balance
    const challengedUserRef = ref(database, `users/${userId}`);
    const challengedUserSnap = await get(challengedUserRef);
    const challengedUser = challengedUserSnap.val();

    if (!challengedUser) {
      return res.status(404).json({ error: "Challenged user not found" });
    }

    const challengedWallet = challengedUser.wallet || {};
    const challengedBalance =
      challengedWallet.amount || challengedUser.points || 0;

    if (challengedBalance < challengeData.betAmount) {
      return res
        .status(400)
        .json({ error: "Insufficient wallet balance to accept challenge" });
    }

    // Deduct bet amount from challenged user's wallet (hold in escrow)
    const challengedWalletUpdates = {
      amount: challengedBalance - challengeData.betAmount,
      escrowBalance:
        (challengedWallet.escrowBalance || 0) + challengeData.betAmount,
      lastTransaction: {
        type: "challenge_accept",
        amount: challengeData.betAmount,
        challengeId,
        timestamp: Date.now(),
      },
    };

    // Update challenge status
    const updatedChallengeData = {
      ...challengeData,
      status: "accepted",
      acceptedAt: Date.now(),
    };

    const encryptedUpdatedChallenge = encryptData(
      updatedChallengeData,
      ENCRYPTION_KEY
    );

    // Update challenge and wallet
    await update(challengeRef, encryptedUpdatedChallenge);
    await update(challengedUserRef, {
      wallet: {
        ...challengedWallet,
        ...challengedWalletUpdates,
      },
    });

    // Log transaction for audit
    const auditLog = {
      challengeId,
      type: "challenge_accepted",
      userId,
      amount: challengeData.betAmount,
      timestamp: Date.now(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const auditRef = ref(database, `auditLogs/challenges/${challengeId}`);
    await set(auditRef, auditLog);

    res.json({
      success: true,
      message: "Challenge accepted successfully",
      data: {
        challengeId,
        gameId: challengeData.gameId,
        gameTitle: challengeData.gameTitle,
        betAmount: challengeData.betAmount,
      },
    });
  } catch (error) {
    console.error("Error accepting challenge:", error);
    res.status(500).json({
      error: "Failed to accept challenge",
      message: error.message,
    });
  }
};

/**
 * Reject a challenge
 */
const rejectChallenge = async (req, res) => {
  try {
    const challengeId = req.params.challengeId;
    const userId = req.user.uid;

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate user can reject this challenge
    if (challengeData.challengedId !== userId) {
      return res
        .status(403)
        .json({ error: "Unauthorized: You cannot reject this challenge" });
    }

    if (challengeData.status !== "pending") {
      return res.status(400).json({ error: "Challenge is no longer pending" });
    }

    // Calculate refund amount with 4% rejection fee (96% refund to challenger)
    const rejectionFee = Math.round(challengeData.betAmount * 0.04); // 4%
    const refundAmount = challengeData.betAmount - rejectionFee;

    // Get challenger's wallet
    const challengerUserRef = ref(
      database,
      `users/${challengeData.challengerId}`
    );
    const challengerUserSnap = await get(challengerUserRef);
    const challengerUser = challengerUserSnap.val();
    const challengerWallet = challengerUser.wallet || {};

    // Refund challenger (minus 4% rejection fee)
    const challengerWalletUpdates = {
      amount: (challengerWallet.amount || 0) + refundAmount,
      escrowBalance:
        (challengerWallet.escrowBalance || 0) - challengeData.betAmount,
      lastTransaction: {
        type: "challenge_rejected_refund",
        amount: refundAmount,
        rejectionFee,
        challengeId,
        timestamp: Date.now(),
      },
      updatedAt: new Date().toISOString(),
    };

    // Update challenge status
    const updatedChallengeData = {
      ...challengeData,
      status: "rejected",
      rejectedAt: Date.now(),
      rejectedBy: userId,
      refundAmount,
      rejectionFee,
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

    // Log transaction for audit
    const auditLog = {
      challengeId,
      type: "challenge_rejected",
      userId,
      amount: challengeData.betAmount,
      refundAmount,
      rejectionFee,
      timestamp: Date.now(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const auditRef = ref(database, `auditLogs/challenges/${challengeId}`);
    await set(auditRef, auditLog);

    res.json({
      success: true,
      message: `Challenge rejected. Refunded ${refundAmount} shillings to challenger (4% rejection fee applied).`,
      data: {
        challengeId,
        refundAmount,
        rejectionFee,
        originalAmount: challengeData.betAmount,
      },
    });
  } catch (error) {
    console.error("Error rejecting challenge:", error);
    res.status(500).json({
      error: "Failed to reject challenge",
      message: error.message,
    });
  }
};

/**
 * Submit challenge score
 */
const submitChallengeScore = async (req, res) => {
  try {
    const { challengeId, score } = req.body;
    const userId = req.user.uid;

    // Validate score
    if (typeof score !== "number" || score < 0 || !isFinite(score)) {
      return res.status(400).json({ error: "Invalid score" });
    }

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate user can submit score for this challenge
    if (
      challengeData.challengerId !== userId &&
      challengeData.challengedId !== userId
    ) {
      return res.status(403).json({
        error: "Unauthorized: You cannot submit score for this challenge",
      });
    }

    if (challengeData.status !== "accepted") {
      return res
        .status(400)
        .json({ error: "Challenge must be accepted before submitting score" });
    }

    // Check if user has already submitted a score
    if (
      challengeData.challengerId === userId &&
      challengeData.challengerScore !== null
    ) {
      return res.status(400).json({
        error: "You have already submitted a score for this challenge",
      });
    }

    if (
      challengeData.challengedId === userId &&
      challengeData.challengedScore !== null
    ) {
      return res.status(400).json({
        error: "You have already submitted a score for this challenge",
      });
    }

    // Update challenge with score
    const updatedChallengeData = {
      ...challengeData,
      [`${
        challengeData.challengerId === userId ? "challenger" : "challenged"
      }Score`]: score,
      [`${
        challengeData.challengerId === userId ? "challenger" : "challenged"
      }SubmittedAt`]: Date.now(),
    };

    // Check if both scores are submitted
    if (
      updatedChallengeData.challengerScore !== null &&
      updatedChallengeData.challengedScore !== null
    ) {
      // Determine winner and process payment
      const winnerId =
        updatedChallengeData.challengerScore >
        updatedChallengeData.challengedScore
          ? updatedChallengeData.challengerId
          : updatedChallengeData.challengedScore >
            updatedChallengeData.challengerScore
          ? updatedChallengeData.challengedId
          : null; // Tie

      updatedChallengeData.status = "completed";
      updatedChallengeData.completedAt = Date.now();
      updatedChallengeData.winnerId = winnerId;

      // Process payments
      await processChallengeCompletion(updatedChallengeData);
    }

    const encryptedUpdatedChallenge = encryptData(
      updatedChallengeData,
      ENCRYPTION_KEY
    );

    // Update challenge
    await update(challengeRef, encryptedUpdatedChallenge);

    // Log transaction for audit
    const auditLog = {
      challengeId,
      type: "score_submitted",
      userId,
      score,
      timestamp: Date.now(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    };

    const auditRef = ref(database, `auditLogs/challenges/${challengeId}`);
    await set(auditRef, auditLog);

    res.json({
      success: true,
      message: "Score submitted successfully",
      data: {
        challengeId,
        score,
        bothScoresSubmitted: updatedChallengeData.status === "completed",
      },
    });
  } catch (error) {
    console.error("Error submitting challenge score:", error);
    res.status(500).json({
      error: "Failed to submit score",
      message: error.message,
    });
  }
};

/**
 * Process challenge completion and payments
 */
const processChallengeCompletion = async (challengeData) => {
  try {
    const {
      challengerId,
      challengedId,
      betAmount,
      serviceCharge,
      netPrize,
      winnerId,
    } = challengeData;

    // Get both users' wallets
    const challengerUserRef = ref(database, `users/${challengerId}`);
    const challengedUserRef = ref(database, `users/${challengedId}`);

    const challengerUserSnap = await get(challengerUserRef);
    const challengedUserSnap = await get(challengedUserRef);

    const challengerUser = challengerUserSnap.val();
    const challengedUser = challengedUserSnap.val();

    const challengerWallet = challengerUser.wallet || {};
    const challengedWallet = challengedUser.wallet || {};

    // Release escrow amounts
    const challengerWalletUpdates = {
      escrowBalance: (challengerWallet.escrowBalance || 0) - betAmount,
    };

    const challengedWalletUpdates = {
      escrowBalance: (challengedWallet.escrowBalance || 0) - betAmount,
    };

    if (winnerId) {
      // There's a winner
      if (winnerId === challengerId) {
        challengerWalletUpdates.amount =
          (challengerWallet.amount || 0) + netPrize;
        challengerWalletUpdates.lastTransaction = {
          type: "challenge_win",
          amount: netPrize,
          challengeId: challengeData.challengeId,
          timestamp: Date.now(),
        };
      } else {
        challengedWalletUpdates.amount =
          (challengedWallet.amount || 0) + netPrize;
        challengedWalletUpdates.lastTransaction = {
          type: "challenge_win",
          amount: netPrize,
          challengeId: challengeData.challengeId,
          timestamp: Date.now(),
        };
      }
    } else {
      // Tie - refund both users minus service charge
      const refundAmount =
        betAmount - Math.round(betAmount * (SERVICE_CHARGE_PERCENTAGE / 100));

      challengerWalletUpdates.amount =
        (challengerWallet.amount || 0) + refundAmount;
      challengerWalletUpdates.lastTransaction = {
        type: "challenge_tie_refund",
        amount: refundAmount,
        serviceCharge: Math.round(
          betAmount * (SERVICE_CHARGE_PERCENTAGE / 100)
        ),
        challengeId: challengeData.challengeId,
        timestamp: Date.now(),
      };

      challengedWalletUpdates.amount =
        (challengedWallet.amount || 0) + refundAmount;
      challengedWalletUpdates.lastTransaction = {
        type: "challenge_tie_refund",
        amount: refundAmount,
        serviceCharge: Math.round(
          betAmount * (SERVICE_CHARGE_PERCENTAGE / 100)
        ),
        challengeId: challengeData.challengeId,
        timestamp: Date.now(),
      };
    }

    // Update wallets
    await update(challengerUserRef, {
      wallet: {
        ...challengerWallet,
        ...challengerWalletUpdates,
      },
    });
    await update(challengedUserRef, {
      wallet: {
        ...challengedWallet,
        ...challengedWalletUpdates,
      },
    });

    console.log(
      `Challenge ${challengeData.challengeId} completed. Winner: ${
        winnerId || "Tie"
      }`
    );
  } catch (error) {
    console.error("Error processing challenge completion:", error);
    throw error;
  }
};

/**
 * Get user's challenge history
 */
const getChallengeHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 10, offset = 0 } = req.query;

    // Get user's challenges (both as challenger and challenged)
    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (!challengesSnap.exists()) {
      return res.json({ success: true, challenges: [] });
    }

    const allChallenges = challengesSnap.val();
    const userChallenges = [];

    // Decrypt and filter user's challenges
    for (const [challengeId, encryptedData] of Object.entries(allChallenges)) {
      try {
        const challengeData = decryptData(encryptedData, ENCRYPTION_KEY);

        if (
          challengeData.challengerId === userId ||
          challengeData.challengedId === userId
        ) {
          // Get opponent user data for display names and avatars
          let challengerName = "Unknown Player";
          let challengedName = "Unknown Player";
          let challengerAvatar = "";
          let challengedAvatar = "";

          try {
            // Get only specific fields from challenger user data to avoid circular refs
            const challengerDisplayNameRef = ref(
              database,
              `users/${challengeData.challengerId}/displayName`
            );
            const challengerNameRef = ref(
              database,
              `users/${challengeData.challengerId}/name`
            );
            const challengerUsernameRef = ref(
              database,
              `users/${challengeData.challengerId}/username`
            );
            const challengerAvatarRef = ref(
              database,
              `users/${challengeData.challengerId}/photoURL`
            );

            const [displayNameSnap, nameSnap, usernameSnap, avatarSnap] =
              await Promise.all([
                get(challengerDisplayNameRef),
                get(challengerNameRef),
                get(challengerUsernameRef),
                get(challengerAvatarRef),
              ]);

            challengerName =
              displayNameSnap.val() ||
              nameSnap.val() ||
              usernameSnap.val() ||
              "Unknown Player";
            challengerAvatar = avatarSnap.val() || "";

            // Get only specific fields from challenged user data to avoid circular refs
            const challengedDisplayNameRef = ref(
              database,
              `users/${challengeData.challengedId}/displayName`
            );
            const challengedNameRef = ref(
              database,
              `users/${challengeData.challengedId}/name`
            );
            const challengedUsernameRef = ref(
              database,
              `users/${challengeData.challengedId}/username`
            );
            const challengedAvatarRef = ref(
              database,
              `users/${challengeData.challengedId}/photoURL`
            );

            const [
              challengedDisplayNameSnap,
              challengedNameSnap,
              challengedUsernameSnap,
              challengedAvatarSnap,
            ] = await Promise.all([
              get(challengedDisplayNameRef),
              get(challengedNameRef),
              get(challengedUsernameRef),
              get(challengedAvatarRef),
            ]);

            challengedName =
              challengedDisplayNameSnap.val() ||
              challengedNameSnap.val() ||
              challengedUsernameSnap.val() ||
              "Unknown Player";
            challengedAvatar = challengedAvatarSnap.val() || "";
          } catch (userError) {
            console.warn("Failed to fetch user data for challenge:", userError);
          }

          // Remove sensitive data for response
          const safeChallengeData = {
            challengeId: challengeData.challengeId,
            challengerId: challengeData.challengerId,
            challengedId: challengeData.challengedId,
            challengerName,
            challengedName,
            challengerAvatar,
            challengedAvatar,
            gameId: challengeData.gameId,
            gameTitle: challengeData.gameTitle,
            gameImage: challengeData.gameImage,
            betAmount: challengeData.betAmount,
            status: challengeData.status,
            createdAt: challengeData.createdAt,
            completedAt: challengeData.completedAt,
            winnerId: challengeData.winnerId,
            challengerScore: challengeData.challengerScore,
            challengedScore: challengeData.challengedScore,
            isChallenger: challengeData.challengerId === userId,
            opponentId:
              challengeData.challengerId === userId
                ? challengeData.challengedId
                : challengeData.challengerId,
          };

          userChallenges.push(safeChallengeData);
        }
      } catch (decryptError) {
        console.warn(
          `Failed to decrypt challenge ${challengeId}:`,
          decryptError
        );
      }
    }

    // Sort by creation date (newest first) and paginate
    userChallenges.sort((a, b) => b.createdAt - a.createdAt);
    const paginatedChallenges = userChallenges.slice(offset, offset + limit);

    res.json({
      success: true,
      challenges: paginatedChallenges,
      total: userChallenges.length,
      hasMore: userChallenges.length > offset + limit,
    });
  } catch (error) {
    console.error("Error getting challenge history:", error);
    res.status(500).json({
      error: "Failed to get challenge history",
      message: error.message,
    });
  }
};

module.exports = {
  createChallenge,
  acceptChallenge,
  rejectChallenge,
  submitChallengeScore,
  getChallengeHistory,
};
