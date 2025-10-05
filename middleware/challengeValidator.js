const crypto = require("crypto");

/**
 * Challenge validation middleware
 * Ensures secure and valid challenge requests
 */

/**
 * Validate challenge creation request
 */
const validateChallengeRequest = (req, res, next) => {
  try {
    const { challengerId, challengedId, gameId, betAmount, gameTitle } =
      req.body;
    const userId = req.user.uid;

    // Validate required fields
    if (!challengerId || !challengedId || !gameId || !betAmount) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["challengerId", "challengedId", "gameId", "betAmount"],
      });
    }

    // Validate user authorization
    if (challengerId !== userId) {
      return res.status(403).json({
        error: "Unauthorized: You can only create challenges for yourself",
      });
    }

    // Validate bet amount
    if (typeof betAmount !== "number" || betAmount < 20 || betAmount > 10000) {
      return res.status(400).json({
        error: "Invalid bet amount. Must be between 20 and 10,000 shillings",
      });
    }

    // Validate user IDs format (should be valid Firebase UIDs)
    const uidRegex = /^[a-zA-Z0-9_-]{28}$/;
    if (!uidRegex.test(challengerId) || !uidRegex.test(challengedId)) {
      return res.status(400).json({
        error: "Invalid user ID format",
      });
    }

    // Prevent self-challenge
    if (challengerId === challengedId) {
      return res.status(400).json({
        error: "Cannot challenge yourself",
      });
    }

    // Validate game ID
    if (typeof gameId !== "string" || gameId.length < 10) {
      return res.status(400).json({
        error: "Invalid game ID",
      });
    }

    // Validate game title
    if (!gameTitle || typeof gameTitle !== "string" || gameTitle.length > 100) {
      return res.status(400).json({
        error: "Invalid game title",
      });
    }

    // Rate limiting check (prevent spam challenges)
    const rateLimitKey = `challenge_rate_${userId}`;
    const now = Date.now();
    const rateLimitWindow = 5 * 60 * 1000; // 5 minutes
    const maxChallengesPerWindow = 5;

    // This would typically be stored in Redis or similar
    // For now, we'll add it to the request for the controller to handle
    req.rateLimitCheck = {
      key: rateLimitKey,
      window: rateLimitWindow,
      max: maxChallengesPerWindow,
    };

    // Validate request signature for additional security
    const signature = req.headers["x-request-signature"];
    if (signature) {
      const isValidSignature = verifyRequestSignature(req.body, signature);
      if (!isValidSignature) {
        return res.status(403).json({
          error: "Invalid request signature",
        });
      }
    }

    // Sanitize input data
    req.sanitizedChallengeData = {
      challengerId: challengerId.trim(),
      challengedId: challengedId.trim(),
      gameId: gameId.trim(),
      betAmount: Math.floor(betAmount),
      gameTitle: gameTitle.trim().substring(0, 100),
      gameImage: req.body.gameImage || null,
    };

    next();
  } catch (error) {
    console.error("Challenge validation error:", error);
    res.status(500).json({
      error: "Validation failed",
      message: error.message,
    });
  }
};

/**
 * Validate score submission request
 */
const validateScoreSubmission = (req, res, next) => {
  try {
    const { challengeId, score } = req.body;
    const userId = req.user.uid;

    // Validate required fields
    if (!challengeId || score === undefined || score === null) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["challengeId", "score"],
      });
    }

    // Validate challenge ID format
    if (typeof challengeId !== "string" || challengeId.length < 20) {
      return res.status(400).json({
        error: "Invalid challenge ID format",
      });
    }

    // Validate score
    if (
      typeof score !== "number" ||
      !isFinite(score) ||
      score < 0 ||
      score > 999999
    ) {
      return res.status(400).json({
        error: "Invalid score. Must be a number between 0 and 999,999",
      });
    }

    // Rate limiting for score submissions
    const rateLimitKey = `score_submission_${userId}_${challengeId}`;
    req.rateLimitCheck = {
      key: rateLimitKey,
      window: 60 * 1000, // 1 minute
      max: 1, // Only one score submission per challenge
    };

    req.sanitizedScoreData = {
      challengeId: challengeId.trim(),
      score: Math.floor(score),
    };

    next();
  } catch (error) {
    console.error("Score validation error:", error);
    res.status(500).json({
      error: "Score validation failed",
      message: error.message,
    });
  }
};

/**
 * Verify request signature for additional security
 */
const verifyRequestSignature = (data, signature) => {
  try {
    const secret = process.env.REQUEST_SIGNATURE_SECRET || "default-secret";
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(data))
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
};

/**
 * Validate wallet balance for challenge operations
 */
const validateWalletBalance = async (req, res, next) => {
  try {
    const { betAmount } = req.sanitizedChallengeData;
    const userId = req.user.uid;

    // This would typically check the database
    // For now, we'll add the validation to the request
    req.walletValidation = {
      userId,
      requiredAmount: betAmount,
      checkType: "challenge_creation",
    };

    next();
  } catch (error) {
    console.error("Wallet validation error:", error);
    res.status(500).json({
      error: "Wallet validation failed",
      message: error.message,
    });
  }
};

/**
 * Anti-fraud middleware
 */
const antiFraudCheck = (req, res, next) => {
  try {
    const userId = req.user.uid;
    const ip = req.ip;
    const userAgent = req.get("User-Agent");

    // Check for suspicious patterns
    const suspiciousPatterns = [/bot/i, /crawler/i, /spider/i, /scraper/i];

    if (suspiciousPatterns.some((pattern) => pattern.test(userAgent))) {
      return res.status(403).json({
        error: "Automated requests not allowed",
      });
    }

    // Add fraud check data to request
    req.fraudCheck = {
      userId,
      ip,
      userAgent,
      timestamp: Date.now(),
    };

    next();
  } catch (error) {
    console.error("Anti-fraud check error:", error);
    res.status(500).json({
      error: "Security check failed",
      message: error.message,
    });
  }
};

/**
 * Challenge expiration middleware
 */
const checkChallengeExpiration = async (req, res, next) => {
  try {
    // Get challengeId from params (for routes like /accept/:challengeId) or body (for other routes)
    const challengeId = req.params.challengeId || req.body.challengeId;

    if (!challengeId) {
      return res.status(400).json({
        error: "Challenge ID is required",
      });
    }

    // This would typically check the database for challenge expiration
    // For now, we'll add the check to the request
    req.expirationCheck = {
      challengeId,
      currentTime: Date.now(),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    };

    next();
  } catch (error) {
    console.error("Expiration check error:", error);
    res.status(500).json({
      error: "Expiration check failed",
      message: error.message,
    });
  }
};

module.exports = {
  validateChallengeRequest,
  validateScoreSubmission,
  validateWalletBalance,
  antiFraudCheck,
  checkChallengeExpiration,
  verifyRequestSignature,
};
