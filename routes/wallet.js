const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const { generalLimiter } = require("../middleware/rateLimiter");
const {
  getWalletBalance,
  initializeWallet,
  getWalletTransactions,
} = require("../controllers/walletController");

/**
 * Wallet Routes
 * All routes require authentication
 */

// Get user's wallet balance
router.get("/balance", authenticateToken, generalLimiter, getWalletBalance);

// Get user's wallet transactions
router.get(
  "/transactions",
  authenticateToken,
  generalLimiter,
  getWalletTransactions
);

// Initialize user wallet with starting balance
router.post("/initialize", authenticateToken, generalLimiter, initializeWallet);

module.exports = router;
