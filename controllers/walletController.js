const { database } = require("../config/firebase");
const { ref, get, set, push, update } = require("firebase/database");

/**
 * Get user's wallet balance
 */
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.uid;

    // Check if user exists in users collection first
    const userRef = ref(database, `users/${userId}`);
    const userSnap = await get(userRef);
    const user = userSnap.val();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Use existing wallet structure: users/{userId}/wallet
    const wallet = user.wallet;

    if (!wallet) {
      // Create wallet with starting balance if it doesn't exist
      const newWallet = {
        amount: 1000, // Starting balance (using 'amount' to match existing structure)
        escrowBalance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Update user document with wallet
      await update(userRef, {
        wallet: newWallet,
      });

      return res.json({
        success: true,
        balance: newWallet.amount,
        escrowBalance: newWallet.escrowBalance,
        message: "Wallet created with starting balance",
      });
    }

    res.json({
      success: true,
      balance: wallet.amount || 0,
      escrowBalance: wallet.escrowBalance || 0,
    });
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get wallet balance",
    });
  }
};

/**
 * Initialize user wallet with starting balance
 */
const initializeWallet = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { startingBalance = 1000 } = req.body;

    // Check if user exists in users collection first
    const userRef = ref(database, `users/${userId}`);
    const userSnap = await get(userRef);
    const user = userSnap.val();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Check if wallet already exists
    const existingWallet = user.wallet;

    if (existingWallet) {
      return res.json({
        success: true,
        balance: existingWallet.amount || 0,
        escrowBalance: existingWallet.escrowBalance || 0,
        message: "Wallet already exists",
      });
    }

    // Create new wallet in user document
    const newWallet = {
      amount: startingBalance, // Using 'amount' to match existing structure
      escrowBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Update user document with wallet
    await update(userRef, {
      wallet: newWallet,
    });

    res.json({
      success: true,
      balance: newWallet.amount,
      escrowBalance: newWallet.escrowBalance,
      message: "Wallet initialized successfully",
    });
  } catch (error) {
    console.error("Error initializing wallet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to initialize wallet",
    });
  }
};

/**
 * Get user's wallet transactions history
 */
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 20, offset = 0 } = req.query;

    const userRef = ref(database, `users/${userId}`);
    const userSnap = await get(userRef);
    const user = userSnap.val();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Get transactions from wallet
    const transactions = user.wallet?.transactions || [];

    // Sort by date (newest first) and paginate
    const sortedTransactions = Object.values(transactions)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      transactions: sortedTransactions,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        total: transactions.length,
        hasMore: parseInt(offset) + parseInt(limit) < transactions.length,
      },
    });
  } catch (error) {
    console.error("Error getting wallet transactions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get wallet transactions",
    });
  }
};

/**
 * Add wallet transaction (internal use for challenges, etc)
 */
const addWalletTransaction = async (
  userId,
  amount,
  type,
  description,
  metadata = {}
) => {
  try {
    const userRef = ref(database, `users/${userId}`);
    const userSnap = await get(userRef);
    const user = userSnap.val();

    if (!user) {
      throw new Error("User not found");
    }

    const currentBalance = user.wallet?.amount || 0;
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      throw new Error("Insufficient wallet balance");
    }

    const transaction = {
      id: push(ref(database, `users/${userId}/wallet/transactions`)).key,
      amount,
      type, // 'credit', 'debit', 'escrow', 'release'
      description,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      metadata,
      createdAt: new Date().toISOString(),
    };

    // Update wallet balance and add transaction
    await update(userRef, {
      "wallet/amount": newBalance,
      [`wallet/transactions/${transaction.id}`]: transaction,
      "wallet/updatedAt": new Date().toISOString(),
    });

    return { success: true, transaction, newBalance };
  } catch (error) {
    console.error("Error adding wallet transaction:", error);
    throw error;
  }
};

module.exports = {
  getWalletBalance,
  initializeWallet,
  getWalletTransactions,
  addWalletTransaction,
};
