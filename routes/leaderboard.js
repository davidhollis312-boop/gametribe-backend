const express = require("express");
const router = express.Router();
const {
  getLeaderboard,
  getUserRank,
  getUserPointsHistory,
  getPointsStats,
  processPointsForAction,
} = require("../controllers/points");
const authenticate = require("../middleware/auth");

// Get global leaderboard
router.get("/global", async (req, res) => {
  try {
    const { limit = 50, country } = req.query;
    const leaderboard = await getLeaderboard(parseInt(limit), country);
    res.status(200).json({ leaderboard });
  } catch (error) {
    console.error("Error getting global leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Get user's rank
router.get("/rank", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const rank = await getUserRank(userId);
    res.status(200).json({ rank });
  } catch (error) {
    console.error("Error getting user rank:", error);
    res.status(500).json({ error: "Failed to fetch user rank" });
  }
});

// Get user's points history
router.get("/history", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 20 } = req.query;
    const history = await getUserPointsHistory(userId, parseInt(limit));
    res.status(200).json({ history });
  } catch (error) {
    console.error("Error getting user points history:", error);
    res.status(500).json({ error: "Failed to fetch points history" });
  }
});

// Get points statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await getPointsStats();
    res.status(200).json({ stats });
  } catch (error) {
    console.error("Error getting points statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Add points for an action (for testing/debugging)
router.post("/add-points", authenticate, async (req, res) => {
  try {
    const userId = req.user.uid;
    const { action, metadata = {} } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }
    
    const result = await processPointsForAction(userId, action, metadata);
    res.status(200).json({ 
      message: "Points added successfully",
      result 
    });
  } catch (error) {
    console.error("Error adding points:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get country leaderboard
router.get("/country/:countryCode", async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { limit = 50 } = req.query;
    const leaderboard = await getLeaderboard(parseInt(limit), countryCode);
    res.status(200).json({ 
      leaderboard,
      country: countryCode 
    });
  } catch (error) {
    console.error("Error getting country leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch country leaderboard" });
  }
});

module.exports = router; 