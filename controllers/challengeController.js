const crypto = require("crypto");
const { database } = require("../config/firebase");
const admin = require("firebase-admin");
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

// Encryption key validation (NO FALLBACK - must be set in environment)
// For Firebase Functions, validation happens on first use, not at module load
const getEncryptionKey = () => {
  const ENCRYPTION_KEY = process.env.CHALLENGE_ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error(
      "CHALLENGE_ENCRYPTION_KEY must be set and >= 32 characters"
    );
  }
  if (ENCRYPTION_KEY === "your-32-character-secret-key-here!") {
    throw new Error(
      "Default encryption key detected! Set proper key in environment"
    );
  }
  return ENCRYPTION_KEY;
};

// Get encryption key
const ENCRYPTION_KEY = process.env.CHALLENGE_ENCRYPTION_KEY || "";

const SERVICE_CHARGE_PERCENTAGE = 20; // 20% service charge
const MINIMUM_BET_AMOUNT = 20; // 20 shillings minimum
const MAXIMUM_BET_AMOUNT = 10000; // 10,000 shillings maximum

// Game session management (for score verification)
const gameSessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

// Maximum scores per game (anti-cheat)
const MAX_SCORES_PER_GAME = {
  default: 100000, // Default max score
  gt_bb: 50000, // GT BB max reasonable score
  2048: 100000, // 2048 max score
  flappy_bird: 1000, // Flappy Bird max reasonable score
  quiz_star: 10000, // Quiz Star max score
  flippin_bottle: 500, // Flippin Bottle max score
};

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
      gameUrl,
    } = req.body;
    const userId = req.user.uid;

    // Validate request
    if (userId !== challengerId) {
      return res.status(403).json({
        error: "Unauthorized: You can only create challenges for yourself",
      });
    }

    // Validate bet amount (both min and max)
    if (betAmount < MINIMUM_BET_AMOUNT || betAmount > MAXIMUM_BET_AMOUNT) {
      return res.status(400).json({
        error: `Bet amount must be between ${MINIMUM_BET_AMOUNT} and ${MAXIMUM_BET_AMOUNT} shillings`,
      });
    }

    // VALIDATE GAME EXISTS in Firestore
    console.log(`🎮 Validating game exists: ${gameId}`);
    try {
      const firestore = admin.firestore();
      const gameDoc = await firestore.collection("games").doc(gameId).get();

      if (!gameDoc.exists) {
        console.error(`❌ Game not found in Firestore: ${gameId}`);
        return res.status(404).json({
          error: "Game not found",
          details: "The selected game does not exist or has been removed.",
          gameId: gameId,
        });
      }

      const gameData = gameDoc.data();
      console.log(`✅ Game found: ${gameData.title || gameTitle}`);

      // Optional: Update gameTitle and gameImage from Firestore if they're different
      if (gameData.title && gameData.title !== gameTitle) {
        console.log(
          `📝 Updating game title from "${gameTitle}" to "${gameData.title}"`
        );
      }
    } catch (gameError) {
      console.error(`❌ Error validating game: ${gameError.message}`);
      return res.status(500).json({
        error: "Failed to validate game",
        details: gameError.message,
      });
    }

    // Check challenger's wallet balance (using existing structure: users/{userId}/wallet)
    console.log(`👤 Validating challenger user: ${challengerId}`);
    const challengerUserRef = ref(database, `users/${challengerId}`);
    const challengerUserSnap = await get(challengerUserRef);
    const challengerUser = challengerUserSnap.val();

    if (!challengerUser) {
      console.error(
        `❌ Challenger user not found in Realtime Database: ${challengerId}`
      );
      console.error(
        `💡 Hint: User may need to sync their profile from PlayChat app (Profile > Sync button)`
      );
      return res.status(404).json({
        error: "Challenger user not found",
        details:
          "Your profile is not synced to the database. Please go to Profile > Tap 'Sync Profile' button, then try again.",
        userId: challengerId,
      });
    }
    console.log(
      `✅ Challenger user found: ${challengerUser.username || "Unknown"}`
    );

    const challengerWallet = challengerUser.wallet;
    const challengerBalance = challengerWallet?.amount || 0;
    const challengerEscrow = challengerWallet?.escrowBalance || 0;

    console.log(`💰 Challenger wallet details:`, {
      available: challengerBalance,
      escrow: challengerEscrow,
      betAmount: betAmount,
      hasEnough: challengerBalance >= betAmount,
    });

    if (challengerBalance < betAmount) {
      console.error(
        `❌ Insufficient balance: Available ${challengerBalance} KES < Required ${betAmount} KES`
      );
      return res.status(400).json({
        error: "Insufficient wallet balance. Please add funds to your wallet.",
        details: `You have ${challengerBalance} KES available, but need ${betAmount} KES for this challenge. (${challengerEscrow} KES is locked in escrow)`,
        available: challengerBalance,
        required: betAmount,
        escrow: challengerEscrow,
      });
    }
    console.log(
      `✅ Balance check passed: ${challengerBalance} KES >= ${betAmount} KES`
    );

    // Check if challenged user exists and has wallet
    console.log(`👤 Validating challenged user: ${challengedId}`);
    const challengedUserRef = ref(database, `users/${challengedId}`);
    const challengedUserSnap = await get(challengedUserRef);
    const challengedUser = challengedUserSnap.val();

    if (!challengedUser) {
      console.error(
        `❌ Challenged user not found in Realtime Database: ${challengedId}`
      );
      console.error(
        `💡 Hint: Opponent may need to open PlayChat app and sync their profile`
      );
      return res.status(404).json({
        error: "Challenged user not found",
        details:
          "The opponent's profile is not synced to the database. They need to open PlayChat app and tap Profile > Sync Profile button.",
        userId: challengedId,
      });
    }
    console.log(
      `✅ Challenged user found: ${challengedUser.username || "Unknown"}`
    );
    console.log(
      `💰 Challenged wallet balance: ${challengedUser.wallet?.amount || 0} KES`
    );

    const challengedWallet = challengedUser.wallet;
    const challengedBalance = challengedWallet?.amount || 0;

    if (challengedBalance < betAmount) {
      return res.status(400).json({
        error:
          "Challenged user has insufficient wallet balance. They need to add funds first.",
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
    const totalPot = betAmount * 2;
    const challengeData = {
      challengeId,
      challengerId,
      challengedId,
      gameId,
      gameTitle,
      gameImage,
      gameUrl: gameUrl || "",
      betAmount,
      status: "pending", // pending, accepted, completed, rejected, cancelled
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      challengerScore: null,
      challengedScore: null,
      winnerId: null,
      serviceCharge: Math.round(totalPot * 0.2), // 20% of total pot
      totalPrize: totalPot, // Total amount in pot
      netPrize: Math.round(totalPot * 0.8), // Winner gets 80% of total pot
    };

    // Encrypt sensitive challenge data
    const encryptedChallengeData = encryptData(challengeData, ENCRYPTION_KEY);

    // SECURITY FIX: Use atomic transaction for wallet deduction
    const challengerWalletRef = admin
      .database()
      .ref(`users/${challengerId}/wallet`);

    let transactionSuccess = false;
    await challengerWalletRef.transaction((wallet) => {
      if (!wallet) {
        console.error("Wallet not found during transaction");
        return wallet;
      }

      const currentBalance = wallet.amount || 0;
      if (currentBalance < betAmount) {
        console.error(`Insufficient balance: ${currentBalance} < ${betAmount}`);
        return; // Abort transaction
      }

      // Atomic wallet update
      wallet.amount = currentBalance - betAmount;
      wallet.escrowBalance = (wallet.escrowBalance || 0) + betAmount;
      wallet.lastTransaction = {
        type: "challenge_bet",
        amount: betAmount,
        challengeId,
        timestamp: Date.now(),
      };
      wallet.updatedAt = new Date().toISOString();

      transactionSuccess = true;
      return wallet;
    });

    if (!transactionSuccess) {
      return res.status(400).json({
        error: "Failed to deduct wallet balance",
        message: "Transaction aborted - please try again",
      });
    }

    // Store encrypted challenge
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    await set(challengeRef, encryptedChallengeData);

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
    const challengedBalance = challengedWallet.amount || 0;

    if (challengedBalance < challengeData.betAmount) {
      return res.status(400).json({
        error:
          "Insufficient wallet balance to accept challenge. Please add funds to your wallet.",
      });
    }

    // SECURITY FIX: Use atomic transaction for wallet deduction
    const challengedWalletRef = admin.database().ref(`users/${userId}/wallet`);

    let transactionSuccess = false;
    await challengedWalletRef.transaction((wallet) => {
      if (!wallet) {
        console.error("Wallet not found during transaction");
        return wallet;
      }

      const currentBalance = wallet.amount || 0;
      if (currentBalance < challengeData.betAmount) {
        console.error(
          `Insufficient balance: ${currentBalance} < ${challengeData.betAmount}`
        );
        return; // Abort transaction
      }

      // Atomic wallet update
      wallet.amount = currentBalance - challengeData.betAmount;
      wallet.escrowBalance =
        (wallet.escrowBalance || 0) + challengeData.betAmount;
      wallet.lastTransaction = {
        type: "challenge_accept",
        amount: challengeData.betAmount,
        challengeId,
        timestamp: Date.now(),
      };
      wallet.updatedAt = new Date().toISOString();

      transactionSuccess = true;
      return wallet;
    });

    if (!transactionSuccess) {
      return res.status(400).json({
        error: "Insufficient wallet balance to accept challenge",
        message: "Transaction aborted - please add funds and try again",
      });
    }

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

    // Update challenge
    await update(challengeRef, encryptedUpdatedChallenge);

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

    // SECURITY FIX: Use atomic transaction for refund
    const challengerWalletRef = admin
      .database()
      .ref(`users/${challengeData.challengerId}/wallet`);

    await challengerWalletRef.transaction((wallet) => {
      if (!wallet) return wallet;

      const currentEscrow = wallet.escrowBalance || 0;
      if (currentEscrow < challengeData.betAmount) {
        console.error(
          `Escrow mismatch: ${currentEscrow} < ${challengeData.betAmount}`
        );
        // Continue anyway for refunds (don't block user)
      }

      // Atomic refund
      wallet.amount = (wallet.amount || 0) + refundAmount;
      wallet.escrowBalance = Math.max(
        0,
        currentEscrow - challengeData.betAmount
      );
      wallet.lastTransaction = {
        type: "challenge_rejected_refund",
        amount: refundAmount,
        rejectionFee,
        challengeId,
        timestamp: Date.now(),
      };
      wallet.updatedAt = new Date().toISOString();

      return wallet;
    });

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

    // Update challenge
    await update(challengeRef, encryptedUpdatedChallenge);

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
 * Start a game session (called when user clicks "Start Game")
 */
const startGameSession = async (req, res) => {
  try {
    const { challengeId } = req.body;
    const userId = req.user.uid;

    // Get challenge to verify user is participant
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Verify user is a participant
    if (
      challengeData.challengerId !== userId &&
      challengeData.challengedId !== userId
    ) {
      return res.status(403).json({
        error: "Unauthorized: You are not a participant in this challenge",
      });
    }

    // Verify challenge is in accepted state
    if (challengeData.status !== "accepted") {
      return res.status(400).json({
        error: "Challenge must be accepted before playing",
      });
    }

    // Check if user already has a score submitted
    const hasSubmitted =
      (challengeData.challengerId === userId &&
        challengeData.challengerScore !== null) ||
      (challengeData.challengedId === userId &&
        challengeData.challengedScore !== null);

    if (hasSubmitted) {
      return res.status(400).json({
        error: "You have already submitted a score for this challenge",
      });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const session = {
      challengeId,
      userId,
      gameId: challengeData.gameId,
      startTime: Date.now(),
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
      used: false,
    };

    gameSessions.set(sessionToken, session);

    // Auto-expire session after timeout
    setTimeout(() => {
      gameSessions.delete(sessionToken);
      console.log(
        `🕐 Game session expired: ${sessionToken.substring(0, 8)}...`
      );
    }, SESSION_TIMEOUT);

    console.log(`🎮 Game session started for challenge ${challengeId}`);

    res.json({
      success: true,
      sessionToken,
      expiresIn: SESSION_TIMEOUT,
      gameId: challengeData.gameId,
      gameTitle: challengeData.gameTitle,
    });
  } catch (error) {
    console.error("Error starting game session:", error);
    res.status(500).json({
      error: "Failed to start game session",
      message: error.message,
    });
  }
};

/**
 * Submit challenge score (with session verification)
 */
const submitChallengeScore = async (req, res) => {
  try {
    const { challengeId, score, sessionToken } = req.body;
    const userId = req.user.uid;

    // Validate score
    if (typeof score !== "number" || score < 0 || !isFinite(score)) {
      return res.status(400).json({ error: "Invalid score" });
    }

    // SECURITY: Verify game session token
    if (!sessionToken) {
      return res.status(400).json({
        error: "Session token required",
        message: "Game must be started through official interface",
      });
    }

    const session = gameSessions.get(sessionToken);
    if (!session) {
      return res.status(403).json({
        error: "Invalid or expired game session",
        message: "Please restart the game and try again",
      });
    }

    // Verify session matches request
    if (
      session.challengeId !== challengeId ||
      session.userId !== userId ||
      session.used
    ) {
      return res.status(403).json({
        error: "Session validation failed",
        message: "Session does not match current request",
      });
    }

    // Verify minimum play time (must play for at least 10 seconds)
    const playTime = Date.now() - session.startTime;
    if (playTime < 10000) {
      return res.status(400).json({
        error: "Invalid play time",
        message: "Game must be played for at least 10 seconds",
      });
    }

    // Mark session as used (one-time use)
    session.used = true;

    // Delete session after use
    setTimeout(() => gameSessions.delete(sessionToken), 5000);

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // SECURITY: Verify score is within reasonable limits for the game
    const maxScore =
      MAX_SCORES_PER_GAME[session.gameId] || MAX_SCORES_PER_GAME.default;
    if (score > maxScore) {
      console.warn(
        `⚠️ FRAUD ALERT: Suspicious score ${score} > ${maxScore} for game ${session.gameId} by user ${userId}`
      );
      // Log fraud attempt
      const fraudRef = ref(
        database,
        `fraudAlerts/score_manipulation_${Date.now()}`
      );
      await set(fraudRef, {
        type: "score_manipulation",
        userId,
        challengeId,
        score,
        maxScore,
        gameId: session.gameId,
        timestamp: Date.now(),
        ipAddress: req.ip,
      });
      return res.status(400).json({
        error: "Score exceeds maximum allowed for this game",
        message: `Maximum score for ${challengeData.gameTitle} is ${maxScore}`,
      });
    }

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
      // There's a winner - gets total pot (both bets) minus 20% service charge
      const totalPot = betAmount * 2;
      const winnerPrize = Math.round(totalPot * 0.8); // 80% of total pot
      const serviceChargeTaken = totalPot - winnerPrize;

      if (winnerId === challengerId) {
        challengerWalletUpdates.amount =
          (challengerWallet.amount || 0) + winnerPrize;
        challengerWalletUpdates.lastTransaction = {
          type: "challenge_win",
          amount: winnerPrize,
          serviceCharge: serviceChargeTaken,
          challengeId: challengeData.challengeId,
          timestamp: Date.now(),
        };
      } else {
        challengedWalletUpdates.amount =
          (challengedWallet.amount || 0) + winnerPrize;
        challengedWalletUpdates.lastTransaction = {
          type: "challenge_win",
          amount: winnerPrize,
          serviceCharge: serviceChargeTaken,
          challengeId: challengeData.challengeId,
          timestamp: Date.now(),
        };
      }
    } else {
      // Tie - refund both users minus 4% service charge each
      const tieFeePercentage = 0.04; // 4% for ties
      const refundAmount = Math.round(betAmount * (1 - tieFeePercentage));
      const serviceChargeTaken = betAmount - refundAmount;

      challengerWalletUpdates.amount =
        (challengerWallet.amount || 0) + refundAmount;
      challengerWalletUpdates.lastTransaction = {
        type: "challenge_tie_refund",
        amount: refundAmount,
        serviceCharge: serviceChargeTaken,
        challengeId: challengeData.challengeId,
        timestamp: Date.now(),
      };

      challengedWalletUpdates.amount =
        (challengedWallet.amount || 0) + refundAmount;
      challengedWalletUpdates.lastTransaction = {
        type: "challenge_tie_refund",
        amount: refundAmount,
        serviceCharge: serviceChargeTaken,
        challengeId: challengeData.challengeId,
        timestamp: Date.now(),
      };
    }

    // SECURITY FIX: Use atomic transactions for wallet updates
    const challengerWalletRef = admin
      .database()
      .ref(`users/${challengerId}/wallet`);
    const challengedWalletRef = admin
      .database()
      .ref(`users/${challengedId}/wallet`);

    // Update challenger wallet atomically
    await challengerWalletRef.transaction((wallet) => {
      if (!wallet) return wallet;

      // Verify and release escrow
      const currentEscrow = wallet.escrowBalance || 0;
      if (currentEscrow < betAmount) {
        console.warn(
          `⚠️ Escrow mismatch for challenger: ${currentEscrow} < ${betAmount}`
        );
      }

      wallet.escrowBalance = Math.max(0, currentEscrow - betAmount);

      if (challengerWalletUpdates.amount !== undefined) {
        wallet.amount = challengerWalletUpdates.amount;
      }
      if (challengerWalletUpdates.lastTransaction) {
        wallet.lastTransaction = challengerWalletUpdates.lastTransaction;
      }
      wallet.updatedAt = new Date().toISOString();

      return wallet;
    });

    // Update challenged wallet atomically
    await challengedWalletRef.transaction((wallet) => {
      if (!wallet) return wallet;

      // Verify and release escrow
      const currentEscrow = wallet.escrowBalance || 0;
      if (currentEscrow < betAmount) {
        console.warn(
          `⚠️ Escrow mismatch for challenged: ${currentEscrow} < ${betAmount}`
        );
      }

      wallet.escrowBalance = Math.max(0, currentEscrow - betAmount);

      if (challengedWalletUpdates.amount !== undefined) {
        wallet.amount = challengedWalletUpdates.amount;
      }
      if (challengedWalletUpdates.lastTransaction) {
        wallet.lastTransaction = challengedWalletUpdates.lastTransaction;
      }
      wallet.updatedAt = new Date().toISOString();

      return wallet;
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
 * Get user's challenge history (OPTIMIZED)
 */
const getChallengeHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 50, offset = 0 } = req.query;

    console.log(`🔍 Fetching challenges for user: ${userId}`);
    const startTime = Date.now();

    // Get user's challenges (both as challenger and challenged)
    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (!challengesSnap.exists()) {
      return res.json({ success: true, data: [], total: 0, hasMore: false });
    }

    const allChallenges = challengesSnap.val();
    const userChallenges = [];
    const uniqueUserIds = new Set();

    // OPTIMIZATION 1: Decrypt only and filter early
    console.log(
      `📦 Total challenges in DB: ${Object.keys(allChallenges).length}`
    );

    for (const [challengeId, encryptedData] of Object.entries(allChallenges)) {
      try {
        const challengeData = decryptData(encryptedData, ENCRYPTION_KEY);

        // Filter early - only process user's challenges
        if (
          challengeData.challengerId === userId ||
          challengeData.challengedId === userId
        ) {
          // Collect unique user IDs for batch fetching
          uniqueUserIds.add(challengeData.challengerId);
          uniqueUserIds.add(challengeData.challengedId);

          // Store minimal challenge data
          userChallenges.push({
            challengeId: challengeData.challengeId,
            challengerId: challengeData.challengerId,
            challengedId: challengeData.challengedId,
            gameId: challengeData.gameId,
            gameTitle: challengeData.gameTitle,
            gameImage: challengeData.gameImage,
            gameUrl: challengeData.gameUrl,
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
          });
        }
      } catch (decryptError) {
        console.warn(
          `Failed to decrypt challenge ${challengeId}:`,
          decryptError.message
        );
      }
    }

    console.log(`✅ User has ${userChallenges.length} challenges`);
    console.log(`👥 Unique users to fetch: ${uniqueUserIds.size}`);

    // OPTIMIZATION 2: Batch fetch only specific user fields (avoid circular references)
    const userDataMap = {};

    if (uniqueUserIds.size > 0) {
      const userDataPromises = Array.from(uniqueUserIds).map(async (uid) => {
        try {
          // Fetch only specific fields to avoid circular references and large data
          const displayNameRef = ref(database, `users/${uid}/displayName`);
          const usernameRef = ref(database, `users/${uid}/username`);
          const photoURLRef = ref(database, `users/${uid}/photoURL`);

          const [displayNameSnap, usernameSnap, photoURLSnap] =
            await Promise.all([
              get(displayNameRef),
              get(usernameRef),
              get(photoURLRef),
            ]);

          return {
            uid,
            displayName: displayNameSnap.val() || usernameSnap.val() || null,
            photoURL: photoURLSnap.val() || "",
          };
        } catch (error) {
          console.warn(`Failed to fetch user ${uid}:`, error.message);
          return { uid, displayName: null, photoURL: "" };
        }
      });

      const usersData = await Promise.all(userDataPromises);
      usersData.forEach((user) => {
        userDataMap[user.uid] = user;
      });
    }

    console.log(`✅ Fetched ${Object.keys(userDataMap).length} user profiles`);

    // OPTIMIZATION 3: Enrich challenges with user data
    const enrichedChallenges = userChallenges.map((challenge) => {
      const challengerData = userDataMap[challenge.challengerId] || {};
      const challengedData = userDataMap[challenge.challengedId] || {};

      return {
        ...challenge,
        challengerName: challengerData.displayName || "Unknown Player",
        challengedName: challengedData.displayName || "Unknown Player",
        challengerAvatar: challengerData.photoURL || "",
        challengedAvatar: challengedData.photoURL || "",
      };
    });

    // Sort by creation date (newest first) and paginate
    enrichedChallenges.sort((a, b) => b.createdAt - a.createdAt);
    const paginatedChallenges = enrichedChallenges.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    const elapsed = Date.now() - startTime;
    console.log(`⚡ Challenge fetch completed in ${elapsed}ms`);

    res.json({
      success: true,
      data: paginatedChallenges,
      total: enrichedChallenges.length,
      hasMore: enrichedChallenges.length > parseInt(offset) + parseInt(limit),
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
  startGameSession,
  submitChallengeScore,
  getChallengeHistory,
};
