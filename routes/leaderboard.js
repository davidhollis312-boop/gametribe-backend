const express = require('express');
const router = express.Router();
const { 
  getGlobalLeaderboard, 
  getCountryLeaderboard, 
  getUserRank, 
  getUserPointsHistory, 
  getPointsStats, 
  getClanLeaderboard, 
  clearLeaderboardCache 
} = require('../controllers/leaderboardController');
const { validateFirebaseToken } = require('../middleware/tokenManager');

// Get global leaderboard (public)
router.get('/global', getGlobalLeaderboard);

// Get country leaderboard (public)
router.get('/country/:countryCode', getCountryLeaderboard);

// Get points statistics (public)
router.get('/stats', getPointsStats);

// Get clan leaderboard (public)
router.get('/clan/:clanId', getClanLeaderboard);

// Get user's rank (authenticated)
router.get('/rank', validateFirebaseToken, getUserRank);

// Get user's points history (authenticated)
router.get('/history', validateFirebaseToken, getUserPointsHistory);

// Clear leaderboard cache (admin only - add admin middleware)
router.post('/clear-cache', clearLeaderboardCache);

module.exports = router;