const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getWalletBalance,
  initializeWallet,
} = require("../controllers/walletController");

/**
 * Wallet Routes
 * All routes require authentication
 */

// Get user's wallet balance
router.get("/balance", authenticateToken, getWalletBalance);

// Initialize user wallet with starting balance
router.post("/initialize", authenticateToken, initializeWallet);

module.exports = router;
