const express = require("express");
const router = express.Router();
const {
  submitScore,
  getUserGameScores,
  getGameLeaderboard,
  getRoomLeaderboard,
  getUserGameStats,
  getAllUserGameStats,
  deleteScore,
} = require("../controllers/gameScoreController");
const {
  validateGameScore,
  validateScoreRetrieval,
} = require("../middleware/gameScoreValidator");
const { validateFirebaseToken } = require("../middleware/tokenManager");

// Apply authentication middleware to all routes
router.use(validateFirebaseToken);

// Submit game score
router.post("/submit", validateGameScore, submitScore);

// Get user's scores for a specific game
router.get("/user/:gameId", validateScoreRetrieval, getUserGameScores);

// Get game leaderboard
router.get("/leaderboard/:gameId", validateScoreRetrieval, getGameLeaderboard);

// Get room leaderboard
router.get("/room/:roomId", validateScoreRetrieval, getRoomLeaderboard);

// Get user's game statistics
router.get("/stats/:gameId", getUserGameStats);

// Get all user's game statistics
router.get("/stats", getAllUserGameStats);

// Delete user's score
router.delete("/:scoreId", deleteScore);

module.exports = router;
