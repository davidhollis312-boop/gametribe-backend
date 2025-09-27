const { database } = require("../config/firebase");
const {
  ref,
  get,
  set,
  push,
  update,
  onValue,
  off,
} = require("firebase/database");
const {
  validateScoreSubmission,
  getGameRules,
} = require("../middleware/gameScoreValidator");

/**
 * Game Score Controller
 * Handles game score submissions, validation, and leaderboard updates
 */

/**
 * Submit game score
 */
const submitScore = async (req, res) => {
  try {
    const { score, gameId, roomId, timestamp } = req.validatedScore;
    const userId = req.user.uid;

    // Get game rules
    const gameRules = getGameRules(gameId);

    // Create score entry
    const scoreEntry = {
      userId,
      gameId,
      score,
      timestamp,
      roomId: roomId || null,
      gameRules: {
        maxScore: gameRules.maxScore,
        allowDecimals: gameRules.allowDecimals,
      },
    };

    // Store score in database
    const scoresRef = ref(database, "gameScores");
    const newScoreRef = push(scoresRef);
    await set(newScoreRef, scoreEntry);

    // Update user's game statistics
    await updateUserGameStats(userId, gameId, score);

    // Update room leaderboard if roomId provided
    if (roomId) {
      await updateRoomLeaderboard(roomId, userId, score, gameId);
    }

    // Update global game leaderboard
    await updateGlobalGameLeaderboard(gameId, userId, score);

    res.json({
      success: true,
      scoreId: newScoreRef.key,
      score: scoreEntry,
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
 * Update user's game statistics
 */
const updateUserGameStats = async (userId, gameId, score) => {
  try {
    const userStatsRef = ref(database, `users/${userId}/gameStats/${gameId}`);
    const snapshot = await get(userStatsRef);
    const currentStats = snapshot.val() || {
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0,
      lastPlayed: Date.now(),
    };

    // Update statistics
    const updatedStats = {
      ...currentStats,
      gamesPlayed: currentStats.gamesPlayed + 1,
      totalScore: currentStats.totalScore + score,
      bestScore: Math.max(currentStats.bestScore, score),
      averageScore: Math.round(
        (currentStats.totalScore + score) / (currentStats.gamesPlayed + 1)
      ),
      lastPlayed: Date.now(),
    };

    await set(userStatsRef, updatedStats);
  } catch (error) {
    console.error("Error updating user game stats:", error);
  }
};

/**
 * Update room leaderboard
 */
const updateRoomLeaderboard = async (roomId, userId, score, gameId) => {
  try {
    const roomLeaderboardRef = ref(database, `roomLeaderboards/${roomId}`);
    const snapshot = await get(roomLeaderboardRef);
    const currentLeaderboard = snapshot.val() || {};

    // Update user's score in room
    currentLeaderboard[userId] = {
      userId,
      score,
      gameId,
      timestamp: Date.now(),
      username:
        req.user.displayName || req.user.email?.split("@")[0] || "Unknown",
    };

    await set(roomLeaderboardRef, currentLeaderboard);
  } catch (error) {
    console.error("Error updating room leaderboard:", error);
  }
};

/**
 * Update global game leaderboard
 */
const updateGlobalGameLeaderboard = async (gameId, userId, score) => {
  try {
    const gameLeaderboardRef = ref(database, `gameLeaderboards/${gameId}`);
    const snapshot = await get(gameLeaderboardRef);
    const currentLeaderboard = snapshot.val() || {};

    // Update user's score
    currentLeaderboard[userId] = {
      userId,
      score,
      timestamp: Date.now(),
      username:
        req.user.displayName || req.user.email?.split("@")[0] || "Unknown",
    };

    await set(gameLeaderboardRef, currentLeaderboard);
  } catch (error) {
    console.error("Error updating global game leaderboard:", error);
  }
};

/**
 * Get user's scores for a specific game
 */
const getUserGameScores = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 20, offset = 0 } = req.validatedQuery;
    const userId = req.user.uid;

    // Fetch user's scores for the game
    const userScoresRef = ref(database, "gameScores");
    const snapshot = await get(userScoresRef);
    const allScores = snapshot.val() || {};

    // Filter user's scores for the specific game
    const userScores = Object.entries(allScores)
      .filter(
        ([_, scoreData]) =>
          scoreData.userId === userId && scoreData.gameId === gameId
      )
      .map(([scoreId, scoreData]) => ({
        scoreId,
        ...scoreData,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      scores: userScores,
      total: userScores.length,
      gameId,
    });
  } catch (error) {
    console.error("Error fetching user game scores:", error);
    res.status(500).json({
      error: "Failed to fetch user game scores",
      message: error.message,
    });
  }
};

/**
 * Get game leaderboard
 */
const getGameLeaderboard = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 50, offset = 0 } = req.validatedQuery;

    // Fetch game leaderboard
    const gameLeaderboardRef = ref(database, `gameLeaderboards/${gameId}`);
    const snapshot = await get(gameLeaderboardRef);
    const leaderboardData = snapshot.val() || {};

    // Convert to array and sort by score
    const leaderboard = Object.entries(leaderboardData)
      .map(([userId, data]) => ({
        userId,
        username: data.username || "Unknown",
        score: data.score || 0,
        timestamp: data.timestamp || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map((entry, index) => ({
        ...entry,
        rank: parseInt(offset) + index + 1,
      }));

    res.json({
      success: true,
      leaderboard,
      total: leaderboard.length,
      gameId,
    });
  } catch (error) {
    console.error("Error fetching game leaderboard:", error);
    res.status(500).json({
      error: "Failed to fetch game leaderboard",
      message: error.message,
    });
  }
};

/**
 * Get room leaderboard
 */
const getRoomLeaderboard = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.validatedQuery;

    // Fetch room leaderboard
    const roomLeaderboardRef = ref(database, `roomLeaderboards/${roomId}`);
    const snapshot = await get(roomLeaderboardRef);
    const leaderboardData = snapshot.val() || {};

    // Convert to array and sort by score
    const leaderboard = Object.entries(leaderboardData)
      .map(([userId, data]) => ({
        userId,
        username: data.username || "Unknown",
        score: data.score || 0,
        gameId: data.gameId || "unknown",
        timestamp: data.timestamp || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
      .map((entry, index) => ({
        ...entry,
        rank: parseInt(offset) + index + 1,
      }));

    res.json({
      success: true,
      leaderboard,
      total: leaderboard.length,
      roomId,
    });
  } catch (error) {
    console.error("Error fetching room leaderboard:", error);
    res.status(500).json({
      error: "Failed to fetch room leaderboard",
      message: error.message,
    });
  }
};

/**
 * Get user's game statistics
 */
const getUserGameStats = async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.uid;

    // Fetch user's game statistics
    const userStatsRef = ref(database, `users/${userId}/gameStats/${gameId}`);
    const snapshot = await get(userStatsRef);
    const stats = snapshot.val() || {
      gamesPlayed: 0,
      totalScore: 0,
      bestScore: 0,
      averageScore: 0,
      lastPlayed: null,
    };

    res.json({
      success: true,
      stats,
      gameId,
      userId,
    });
  } catch (error) {
    console.error("Error fetching user game stats:", error);
    res.status(500).json({
      error: "Failed to fetch user game stats",
      message: error.message,
    });
  }
};

/**
 * Get all user's game statistics
 */
const getAllUserGameStats = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Fetch all user's game statistics
    const userStatsRef = ref(database, `users/${userId}/gameStats`);
    const snapshot = await get(userStatsRef);
    const allStats = snapshot.val() || {};

    // Convert to array
    const stats = Object.entries(allStats).map(([gameId, gameStats]) => ({
      gameId,
      ...gameStats,
    }));

    res.json({
      success: true,
      stats,
      total: stats.length,
      userId,
    });
  } catch (error) {
    console.error("Error fetching all user game stats:", error);
    res.status(500).json({
      error: "Failed to fetch user game stats",
      message: error.message,
    });
  }
};

/**
 * Delete user's score
 */
const deleteScore = async (req, res) => {
  try {
    const { scoreId } = req.params;
    const userId = req.user.uid;

    // Fetch score to verify ownership
    const scoreRef = ref(database, `gameScores/${scoreId}`);
    const snapshot = await get(scoreRef);
    const scoreData = snapshot.val();

    if (!scoreData) {
      return res.status(404).json({
        error: "Score not found",
      });
    }

    if (scoreData.userId !== userId) {
      return res.status(403).json({
        error: "Unauthorized",
        message: "You can only delete your own scores",
      });
    }

    // Delete the score
    await set(scoreRef, null);

    res.json({
      success: true,
      message: "Score deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting score:", error);
    res.status(500).json({
      error: "Failed to delete score",
      message: error.message,
    });
  }
};

module.exports = {
  submitScore,
  getUserGameScores,
  getGameLeaderboard,
  getRoomLeaderboard,
  getUserGameStats,
  getAllUserGameStats,
  deleteScore,
  updateUserGameStats,
  updateRoomLeaderboard,
  updateGlobalGameLeaderboard,
};
