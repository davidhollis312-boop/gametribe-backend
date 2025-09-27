/**
 * Game Score Validation Middleware
 * Validates and normalizes game scores from client
 */

// Game-specific validation rules
const GAME_RULES = {
  default: {
    minScore: 0,
    maxScore: 999999,
    allowDecimals: false,
    allowNegative: false,
  },
  // Add specific game rules here
  "challenge-game-1": {
    minScore: 0,
    maxScore: 10000,
    allowDecimals: false,
    allowNegative: false,
  },
  "arcade-game-1": {
    minScore: 0,
    maxScore: 50000,
    allowDecimals: true,
    allowNegative: false,
  },
};

/**
 * Validate game score format and value
 */
const validateScore = (score, gameId = "default") => {
  const rules = GAME_RULES[gameId] || GAME_RULES.default;

  // Convert to number if string
  let normalizedScore;
  if (typeof score === "string") {
    // Remove any non-numeric characters except decimal point
    const cleanScore = score.replace(/[^\d.-]/g, "");
    normalizedScore = parseFloat(cleanScore);
  } else if (typeof score === "number") {
    normalizedScore = score;
  } else if (typeof score === "object" && score !== null) {
    // Handle object format: { score: 100, type: 'SCORE' }
    normalizedScore =
      score.score || score.result?.score || score.payload?.score;
    if (typeof normalizedScore === "string") {
      normalizedScore = parseFloat(normalizedScore.replace(/[^\d.-]/g, ""));
    }
  } else {
    throw new Error("Invalid score format");
  }

  // Check if score is a valid number
  if (isNaN(normalizedScore) || !isFinite(normalizedScore)) {
    throw new Error("Score must be a valid number");
  }

  // Check decimal places
  if (!rules.allowDecimals && normalizedScore % 1 !== 0) {
    throw new Error("Score must be a whole number");
  }

  // Check negative values
  if (!rules.allowNegative && normalizedScore < 0) {
    throw new Error("Score cannot be negative");
  }

  // Check score range
  if (normalizedScore < rules.minScore) {
    throw new Error(`Score must be at least ${rules.minScore}`);
  }

  if (normalizedScore > rules.maxScore) {
    throw new Error(`Score cannot exceed ${rules.maxScore}`);
  }

  return rules.allowDecimals ? normalizedScore : Math.floor(normalizedScore);
};

/**
 * Validate game ID format
 */
const validateGameId = (gameId) => {
  if (!gameId || typeof gameId !== "string") {
    throw new Error("Game ID is required");
  }

  // Check for valid game ID format (alphanumeric, hyphens, underscores)
  if (!/^[a-zA-Z0-9_-]+$/.test(gameId)) {
    throw new Error("Invalid game ID format");
  }

  // Check length
  if (gameId.length < 3 || gameId.length > 50) {
    throw new Error("Game ID must be between 3 and 50 characters");
  }

  return gameId;
};

/**
 * Validate challenge room ID format
 */
const validateRoomId = (roomId) => {
  if (!roomId || typeof roomId !== "string") {
    throw new Error("Room ID is required");
  }

  // Room ID format: gameId_chatId
  const parts = roomId.split("_");
  if (parts.length !== 2) {
    throw new Error("Invalid room ID format");
  }

  const [gameId, chatId] = parts;
  validateGameId(gameId);

  if (!chatId || chatId.length < 1) {
    throw new Error("Invalid chat ID in room ID");
  }

  return roomId;
};

/**
 * Validate score submission data
 */
const validateScoreSubmission = (data) => {
  const { score, gameId, roomId, userId, timestamp } = data;

  // Validate required fields
  if (!score && score !== 0) {
    throw new Error("Score is required");
  }

  if (!gameId) {
    throw new Error("Game ID is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  // Validate score
  const validatedScore = validateScore(score, gameId);

  // Validate game ID
  const validatedGameId = validateGameId(gameId);

  // Validate room ID if provided
  let validatedRoomId = null;
  if (roomId) {
    validatedRoomId = validateRoomId(roomId);
  }

  // Validate timestamp
  let validatedTimestamp = Date.now();
  if (timestamp) {
    const ts = new Date(timestamp);
    if (isNaN(ts.getTime())) {
      throw new Error("Invalid timestamp format");
    }
    // Check if timestamp is not too old (24 hours) or in the future
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    if (ts.getTime() < now - dayInMs || ts.getTime() > now + 60000) {
      throw new Error("Timestamp is outside acceptable range");
    }
    validatedTimestamp = ts.getTime();
  }

  return {
    score: validatedScore,
    gameId: validatedGameId,
    roomId: validatedRoomId,
    userId,
    timestamp: validatedTimestamp,
  };
};

/**
 * Middleware to validate game score submissions
 */
const validateGameScore = (req, res, next) => {
  try {
    const { score, gameId, roomId, timestamp } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        error: "Authentication required",
        message: "User must be authenticated to submit scores",
      });
    }

    const validatedData = validateScoreSubmission({
      score,
      gameId,
      roomId,
      userId,
      timestamp,
    });

    // Add validated data to request
    req.validatedScore = validatedData;
    next();
  } catch (error) {
    console.error("Game score validation error:", error);
    res.status(400).json({
      error: "Score validation failed",
      message: error.message,
    });
  }
};

/**
 * Middleware to validate score retrieval requests
 */
const validateScoreRetrieval = (req, res, next) => {
  try {
    const { gameId, roomId, limit = 50, offset = 0 } = req.query;

    if (gameId) {
      validateGameId(gameId);
    }

    if (roomId) {
      validateRoomId(roomId);
    }

    // Validate pagination parameters
    const validatedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const validatedOffset = Math.max(parseInt(offset) || 0, 0);

    req.validatedQuery = {
      gameId,
      roomId,
      limit: validatedLimit,
      offset: validatedOffset,
    };

    next();
  } catch (error) {
    console.error("Score retrieval validation error:", error);
    res.status(400).json({
      error: "Invalid query parameters",
      message: error.message,
    });
  }
};

/**
 * Utility function to get game rules
 */
const getGameRules = (gameId) => {
  return GAME_RULES[gameId] || GAME_RULES.default;
};

/**
 * Utility function to check if score is valid for a game
 */
const isScoreValid = (score, gameId) => {
  try {
    validateScore(score, gameId);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  validateScore,
  validateGameId,
  validateRoomId,
  validateScoreSubmission,
  validateGameScore,
  validateScoreRetrieval,
  getGameRules,
  isScoreValid,
  GAME_RULES,
};
