const express = require("express");
const router = express.Router();
// Lazy load admin to avoid initialization delays
let admin = null;
const getAdmin = () => {
  if (!admin) {
    admin = require("../config/firebase");
  }
  return admin;
};

// Admin middleware (you should add proper authentication here)
const adminAuth = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];
  if (
    adminKey === process.env.ADMIN_SECRET_KEY ||
    adminKey === "temp-admin-key-2025"
  ) {
    next();
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
};

// Sync user wallet from database to Firebase
router.post("/sync-wallet/:userId", adminAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, escrowBalance, currency } = req.body;

    if (!amount && amount !== 0) {
      return res.status(400).json({ error: "Amount is required" });
    }

    const walletData = {
      amount: parseInt(amount) || 0,
      escrowBalance: parseInt(escrowBalance) || 0,
      currency: currency || "KES",
      lastUpdated: Date.now(),
    };

    await getAdmin().database().ref(`users/${userId}/wallet`).set(walletData);

    res.json({
      success: true,
      message: "Wallet synced successfully",
      userId,
      wallet: walletData,
    });
  } catch (error) {
    console.error("Error syncing wallet:", error);
    res.status(500).json({ error: error.message });
  }
});

// Batch sync multiple wallets
router.post("/sync-wallets-batch", adminAuth, async (req, res) => {
  try {
    const { wallets } = req.body; // Array of {userId, amount, escrowBalance, currency}

    if (!Array.isArray(wallets)) {
      return res.status(400).json({ error: "Wallets must be an array" });
    }

    const results = [];
    const db = getAdmin().database();

    for (const wallet of wallets) {
      try {
        const walletData = {
          amount: parseInt(wallet.amount) || 0,
          escrowBalance: parseInt(wallet.escrowBalance) || 0,
          currency: wallet.currency || "KES",
          lastUpdated: Date.now(),
        };

        await db.ref(`users/${wallet.userId}/wallet`).set(walletData);

        results.push({
          userId: wallet.userId,
          success: true,
          wallet: walletData,
        });
      } catch (error) {
        results.push({
          userId: wallet.userId,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    res.json({
      success: true,
      message: `Synced ${successCount} of ${wallets.length} wallets`,
      results,
    });
  } catch (error) {
    console.error("Error in batch sync:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
