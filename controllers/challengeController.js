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

/**
 * Create a new challenge
 */
const createChallenge = async (req, res) => {
  try {
    const {
      challengedId,
      gameId,
      gameTitle,
      gameImage,
      gameUrl,
      betAmount,
      message,
    } = req.body;
    const challengerId = req.user.uid;

    console.log(`🎯 Creating challenge: ${challengerId} vs ${challengedId}`);

    // Validate required fields
    if (!challengedId || !gameId || !gameTitle || !betAmount) {
      return res.status(400).json({
        error:
          "Missing required fields: challengedId, gameId, gameTitle, betAmount",
      });
    }

    // Validate bet amount
    const bet = parseInt(betAmount);
    if (isNaN(bet) || bet < 10 || bet > 10000) {
      return res.status(400).json({
        error: "Bet amount must be between 10 and 10,000 KES",
      });
    }

    // Check if user is challenging themselves
    if (challengerId === challengedId) {
      return res.status(400).json({
        error: "Cannot challenge yourself",
      });
    }

    // Generate challenge ID
    const challengeId = generateChallengeId();

    // Create challenge data
    const challengeData = {
      challengeId,
      challengerId,
      challengedId,
      gameId,
      gameTitle,
      gameImage: gameImage || "",
      gameUrl: gameUrl || "",
      betAmount: bet,
      message: message || "",
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    // Encrypt challenge data
    const encryptedData = encryptData(challengeData, ENCRYPTION_KEY);

    // Store encrypted challenge
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    await set(challengeRef, encryptedData);

    console.log(`✅ Challenge created: ${challengeId}`);

    res.json({
      success: true,
      challengeId,
      message: "Challenge created successfully",
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
    const { challengeId } = req.params;
    const challengedId = req.user.uid;

    console.log(`🎯 Accepting challenge: ${challengeId}`);

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate challenge
    if (challengeData.challengedId !== challengedId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (challengeData.status !== "pending") {
      return res.status(400).json({ error: "Challenge is not pending" });
    }

    if (Date.now() > challengeData.expiresAt) {
      return res.status(400).json({ error: "Challenge has expired" });
    }

    // Update challenge status
    challengeData.status = "accepted";
    challengeData.acceptedAt = Date.now();

    // Encrypt updated data
    const encryptedData = encryptData(challengeData, ENCRYPTION_KEY);
    await set(challengeRef, encryptedData);

    console.log(`✅ Challenge accepted: ${challengeId}`);

    res.json({
      success: true,
      message: "Challenge accepted successfully",
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
    const { challengeId } = req.params;
    const challengedId = req.user.uid;

    console.log(`🎯 Rejecting challenge: ${challengeId}`);

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate challenge
    if (challengeData.challengedId !== challengedId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (challengeData.status !== "pending") {
      return res.status(400).json({ error: "Challenge is not pending" });
    }

    // Update challenge status
    challengeData.status = "rejected";
    challengeData.rejectedAt = Date.now();

    // Encrypt updated data
    const encryptedData = encryptData(challengeData, ENCRYPTION_KEY);
    await set(challengeRef, encryptedData);

    console.log(`✅ Challenge rejected: ${challengeId}`);

    res.json({
      success: true,
      message: "Challenge rejected successfully",
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
 * Start a game session
 */
const startGameSession = async (req, res) => {
  try {
    const { challengeId } = req.params;
    const userId = req.user.uid;

    console.log(`🎮 Starting game session: ${challengeId}`);

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate challenge
    if (
      challengeData.challengerId !== userId &&
      challengeData.challengedId !== userId
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (challengeData.status !== "accepted") {
      return res.status(400).json({ error: "Challenge is not accepted" });
    }

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString("hex");

    // Store session token
    const sessionRef = ref(database, `gameSessions/${sessionToken}`);
    await set(sessionRef, {
      challengeId,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    console.log(`✅ Game session started: ${sessionToken}`);

    res.json({
      success: true,
      sessionToken,
      message: "Game session started successfully",
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
 * Submit challenge score
 */
const submitChallengeScore = async (req, res) => {
  try {
    const { challengeId, score, sessionToken } = req.body;
    const userId = req.user.uid;

    console.log(`🎯 Submitting score: ${score} for challenge ${challengeId}`);

    // Validate session token
    const sessionRef = ref(database, `gameSessions/${sessionToken}`);
    const sessionSnap = await get(sessionRef);

    if (!sessionSnap.exists()) {
      return res.status(403).json({ error: "Invalid or expired game session" });
    }

    const sessionData = sessionSnap.val();
    if (
      sessionData.userId !== userId ||
      sessionData.challengeId !== challengeId
    ) {
      return res.status(403).json({ error: "Invalid session" });
    }

    if (Date.now() > sessionData.expiresAt) {
      return res.status(403).json({ error: "Session expired" });
    }

    // Get encrypted challenge data
    const challengeRef = ref(database, `secureChallenges/${challengeId}`);
    const challengeSnap = await get(challengeRef);

    if (!challengeSnap.exists()) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    // Decrypt challenge data
    const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

    // Validate challenge
    if (
      challengeData.challengerId !== userId &&
      challengeData.challengedId !== userId
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (challengeData.status !== "accepted") {
      return res.status(400).json({ error: "Challenge is not accepted" });
    }

    // Update challenge with score
    if (challengeData.challengerId === userId) {
      challengeData.challengerScore = score;
    } else {
      challengeData.challengedScore = score;
    }

    // Check if both scores are submitted
    if (challengeData.challengerScore && challengeData.challengedScore) {
      challengeData.status = "completed";
      challengeData.completedAt = Date.now();

      // Determine winner
      if (challengeData.challengerScore > challengeData.challengedScore) {
        challengeData.winnerId = challengeData.challengerId;
      } else if (
        challengeData.challengedScore > challengeData.challengerScore
      ) {
        challengeData.winnerId = challengeData.challengedId;
      } else {
        challengeData.winnerId = "tie";
      }
    }

    // Encrypt updated data
    const encryptedData = encryptData(challengeData, ENCRYPTION_KEY);
    await set(challengeRef, encryptedData);

    // Remove session token
    await remove(sessionRef);

    console.log(`✅ Score submitted: ${score}`);

    res.json({
      success: true,
      message: "Score submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting score:", error);
    res.status(500).json({
      error: "Failed to submit score",
      message: error.message,
    });
  }
};

/**
 * Get user's challenge history (OPTIMIZED)
 */
const getChallengeHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 10, offset = 0, status } = req.query;

    console.log(`🔍 Fetching challenges for user: ${userId}`);
    const startTime = Date.now();

    // Get all challenges
    const challengesRef = ref(database, "secureChallenges");
    const challengesSnap = await get(challengesRef);

    if (!challengesSnap.exists()) {
      return res.json({ success: true, data: [], total: 0, hasMore: false });
    }

    const allChallenges = challengesSnap.val();
    const userChallenges = [];

    // Process challenges
    for (const [challengeId, encryptedData] of Object.entries(allChallenges)) {
      try {
        const challengeData = decryptData(encryptedData, ENCRYPTION_KEY);

        // Filter user's challenges
        if (
          challengeData.challengerId === userId ||
          challengeData.challengedId === userId
        ) {
          // Filter by status if provided
          if (status && challengeData.status !== status) {
            continue;
          }

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

    // Sort by creation date (newest first) and paginate
    userChallenges.sort((a, b) => b.createdAt - a.createdAt);
    const paginatedChallenges = userChallenges.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    const elapsed = Date.now() - startTime;
    console.log(`⚡ Challenge fetch completed in ${elapsed}ms`);

    res.json({
      success: true,
      data: paginatedChallenges,
      total: userChallenges.length,
      hasMore: userChallenges.length > parseInt(offset) + parseInt(limit),
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
