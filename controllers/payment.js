const { database } = require("../config/firebase");
const {
  ref,
  get,
  update,
  query,
  orderByChild,
  equalTo,
} = require("firebase/database");
const { v4: uuidv4 } = require("uuid");
const Stripe = require("stripe");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

// Initialize Stripe (guarded for missing key in local/dev)
let stripe = null;
try {
  if (
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_SECRET_KEY !== "undefined"
  ) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } else {
    console.warn(
      "[Payments] STRIPE_SECRET_KEY not set; Stripe features disabled in this environment."
    );
  }
} catch (e) {
  console.error("[Payments] Failed to initialize Stripe:", e.message);
  stripe = null;
}

// Import M-Pesa configuration utility
const { getMpesaConfig } = require("../utils/mpesaConfig");

// Get M-Pesa configuration
let mpesaConfig = null;
try {
  mpesaConfig = getMpesaConfig();
} catch (error) {
  console.warn("[Payments] M-Pesa configuration not available:", error.message);
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input.replace(/[<>]/g, "");
};

// Retry mechanism for database updates
const updateWithRetry = async (ref, data, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await update(ref, data);
      return;
    } catch (error) {
      console.error(`Retry ${i + 1} failed for update:`, {
        message: error.message,
        stack: error.stack,
      });
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

// Get transaction status (polled by frontend as fallback) - works for both Stripe and M-Pesa
const getStripeTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!transactionId) {
      return res.status(400).json({ error: "transactionId is required" });
    }

    const transactionRef = ref(database, `transactions/${transactionId}`);
    const snapshot = await get(transactionRef);
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const tx = snapshot.val();
    return res.status(200).json({
      status: tx.status || "pending",
      error: tx.error || null,
      pointsToAdd: tx.pointsToAdd || tx.amount || 0,
      method: tx.method || "unknown",
    });
  } catch (error) {
    console.error("Error getting transaction status:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: "Failed to get transaction status" });
  }
};

// Generate M-Pesa OAuth token
const getMpesaToken = async () => {
  try {
    if (!mpesaConfig) {
      throw new Error("M-Pesa configuration not available");
    }

    const auth = Buffer.from(
      `${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`
    ).toString("base64");

    const baseUrl =
      mpesaConfig.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const response = await axios.get(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      { headers: { Authorization: `Basic ${auth}` } }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error generating M-Pesa token:", {
      message: error.message,
      stack: error.stack,
    });
    throw new Error("Failed to generate M-Pesa token");
  }
};

// Create Stripe payment intent
const createStripePayment = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe not configured" });
    }

    // Validate and sanitize input
    const { amount, userId, currency = "kes" } = req.body;
    const sanitizedAmount = parseInt(sanitizeInput(amount));
    const sanitizedUserId = sanitizeInput(userId);
    const sanitizedCurrency = sanitizeInput(currency).toLowerCase();

    if (
      !sanitizedAmount ||
      sanitizedAmount < 1 ||
      sanitizedAmount > 10000 ||
      !Number.isInteger(sanitizedAmount)
    ) {
      return res.status(400).json({
        error: "Amount must be an integer between 1 and 10,000",
      });
    }
    if (
      !sanitizedUserId ||
      typeof sanitizedUserId !== "string" ||
      sanitizedUserId.length < 10
    ) {
      return res.status(400).json({ error: "Valid User ID is required" });
    }

    // Validate currency
    const allowedCurrencies = ["kes", "usd", "eur"];
    if (!allowedCurrencies.includes(sanitizedCurrency)) {
      return res.status(400).json({ error: "Invalid currency" });
    }

    // Validate user is authenticated and matches the requesting user
    if (req.user?.uid !== sanitizedUserId) {
      return res.status(403).json({ error: "Unauthorized: User ID mismatch" });
    }

    const userRef = ref(database, `users/${sanitizedUserId}`);
    const paymentUserSnapshot = await get(userRef);
    if (!paymentUserSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactionId = uuidv4();
    const pointsToAdd = sanitizedAmount; // 1 unit = 1 point, regardless of currency
    const stripeAmount = sanitizedAmount * 100; // Adjust for Stripe (cents)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: sanitizedCurrency,
      payment_method_types: ["card"],
      metadata: {
        userId: sanitizedUserId,
        transactionId,
        pointsToAdd: pointsToAdd.toString(),
        originalAmount: sanitizedAmount.toString(),
        ipAddress: req.ip || "unknown",
      },
    });

    await updateWithRetry(ref(database, `transactions/${transactionId}`), {
      id: transactionId,
      userId: sanitizedUserId,
      type: "deposit",
      method: "stripe",
      amount: sanitizedAmount,
      currency: sanitizedCurrency.toUpperCase(),
      status: "pending",
      paymentIntentId: paymentIntent.id,
      pointsToAdd,
      ipAddress: req.ip || "unknown",
      userAgent: req.get("User-Agent") || "unknown",
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      transactionId,
      pointsToAdd,
    });
  } catch (error) {
    console.error("Error creating Stripe payment:", {
      message: error.message,
      stack: error.stack,
    });
    await updateWithRetry(ref(database, `webhook_errors/stripe_${uuidv4()}`), {
      error: `Failed to create Stripe payment: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ error: "Failed to create Stripe payment" });
  }
};

// Create M-Pesa STK Push payment
const createMpesaPayment = async (req, res) => {
  try {
    if (!mpesaConfig) {
      return res.status(503).json({ error: "M-Pesa not configured" });
    }

    // Validate and sanitize input
    const { amount, phoneNumber, userId, currency = "KES" } = req.body;
    const sanitizedAmount = parseInt(sanitizeInput(amount));
    const sanitizedPhoneNumber = sanitizeInput(phoneNumber);
    const sanitizedUserId = sanitizeInput(userId);
    const sanitizedCurrency = sanitizeInput(currency).toUpperCase();

    if (
      !sanitizedAmount ||
      sanitizedAmount < 1 ||
      sanitizedAmount > 10000 ||
      !Number.isInteger(sanitizedAmount)
    ) {
      return res.status(400).json({
        error: "Amount must be an integer between 1 and 10,000",
      });
    }
    if (
      !sanitizedPhoneNumber ||
      !sanitizedPhoneNumber.match(/^\+254[0-9]{9}$/)
    ) {
      return res.status(400).json({
        error: "Valid phone number is required (e.g., +254712345678)",
      });
    }
    if (
      !sanitizedUserId ||
      typeof sanitizedUserId !== "string" ||
      sanitizedUserId.length < 10
    ) {
      return res.status(400).json({ error: "Valid User ID is required" });
    }

    // Validate user is authenticated and matches the requesting user
    if (req.user?.uid !== sanitizedUserId) {
      return res.status(403).json({ error: "Unauthorized: User ID mismatch" });
    }

    // Validate currency for M-Pesa (only KES supported)
    if (sanitizedCurrency !== "KES") {
      return res
        .status(400)
        .json({ error: "M-Pesa only supports KES currency" });
    }

    const userRef = ref(database, `users/${sanitizedUserId}`);
    const mpesaUserSnapshot = await get(userRef);
    if (!mpesaUserSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const pointsToAdd = sanitizedAmount; // 1 unit = 1 point, regardless of currency
    const token = await getMpesaToken();
    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
    const password = Buffer.from(
      `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`
    ).toString("base64");

    const baseUrl =
      mpesaConfig.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const response = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: mpesaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: sanitizedAmount,
        PartyA: sanitizedPhoneNumber.replace("+", ""),
        PartyB: mpesaConfig.shortcode,
        PhoneNumber: sanitizedPhoneNumber.replace("+", ""),
        CallBackURL: mpesaConfig.callbackUrl,
        AccountReference: `GameTribe_${sanitizedUserId}`,
        TransactionDesc: "Deposit to GameTribe Wallet",
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const transactionId = uuidv4();
    await updateWithRetry(ref(database, `transactions/${transactionId}`), {
      id: transactionId,
      userId: sanitizedUserId,
      type: "deposit",
      method: "mpesa",
      amount: sanitizedAmount,
      currency: sanitizedCurrency,
      status: "pending",
      checkoutRequestId: response.data.CheckoutRequestID,
      pointsToAdd,
      phoneNumber: sanitizedPhoneNumber,
      ipAddress: req.ip || "unknown",
      userAgent: req.get("User-Agent") || "unknown",
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      transactionId,
      checkoutRequestId: response.data.CheckoutRequestID,
      pointsToAdd,
    });
  } catch (error) {
    console.error("Error creating M-Pesa payment:", {
      message: error.message,
      stack: error.stack,
    });
    await updateWithRetry(ref(database, `webhook_errors/mpesa_${uuidv4()}`), {
      error: `Failed to create M-Pesa payment: ${error.message}`,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ error: "Failed to create M-Pesa payment" });
  }
};

// Stripe webhook handler
const stripeWebhook = async (req, res) => {
  if (!stripe || !webhookSecret) {
    console.error("Stripe webhook secret is not defined");
    await updateWithRetry(ref(database, `webhook_errors/stripe_${uuidv4()}`), {
      error: "Webhook secret not defined",
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ error: "Webhook configuration error" });
  }

  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    const eventRef = ref(database, `webhook_events/stripe_${event.id}`);
    const eventSnapshot = await get(eventRef);
    if (eventSnapshot.exists()) {
      return res.status(200).json({ received: true });
    }

    await updateWithRetry(eventRef, {
      processed: true,
      type: event.type,
      createdAt: new Date().toISOString(),
    });

    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        const { transactionId, userId, pointsToAdd } = paymentIntent.metadata;

        if (!transactionId || !userId || !pointsToAdd) {
          console.error(
            "Missing transactionId, userId, or pointsToAdd in payment intent metadata",
            { transactionId, userId, pointsToAdd }
          );
          await updateWithRetry(
            ref(database, `webhook_errors/stripe_${uuidv4()}`),
            {
              error: "Missing metadata",
              eventId: event.id,
              timestamp: new Date().toISOString(),
            }
          );
          return res.status(400).json({ error: "Missing metadata" });
        }

        const points = parseInt(pointsToAdd);
        if (isNaN(points) || points <= 0) {
          console.error("Invalid pointsToAdd value", { pointsToAdd });
          await updateWithRetry(
            ref(database, `webhook_errors/stripe_${uuidv4()}`),
            {
              error: `Invalid pointsToAdd: ${pointsToAdd}`,
              eventId: event.id,
              timestamp: new Date().toISOString(),
            }
          );
          return res.status(400).json({ error: "Invalid pointsToAdd" });
        }

        const transactionRef = ref(database, `transactions/${transactionId}`);
        const transactionSnapshot = await get(transactionRef);
        if (!transactionSnapshot.exists()) {
          console.error(`Transaction ${transactionId} not found`);
          await updateWithRetry(
            ref(database, `webhook_errors/stripe_${uuidv4()}`),
            {
              error: "Transaction not found",
              eventId: event.id,
              transactionId,
              timestamp: new Date().toISOString(),
            }
          );
          return res.status(404).json({ error: "Transaction not found" });
        }

        const transaction = transactionSnapshot.val();
        if (transaction.status === "completed") {
          return res.status(200).json({ received: true });
        }

        await updateWithRetry(transactionRef, {
          status: "completed",
          updatedAt: new Date().toISOString(),
        });

        const userRef = ref(database, `users/${userId}`);
        const userSnapshot = await get(userRef);
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          const currentPoints = userData.points || 0;
          const currentWallet = userData.wallet || {
            amount: 0,
            currency: "KES",
          };

          // Update user points and wallet balance
          await updateWithRetry(userRef, {
            points: currentPoints + points,
            wallet: {
              ...currentWallet,
              amount: (currentWallet.amount || 0) + points, // Also add to wallet balance
              currency: "KES",
              lastUpdated: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          });

          // Record points history entry (idempotent per transaction)
          const historyId = `deposit_stripe_${transactionId}`;
          await updateWithRetry(
            ref(database, `pointsHistory/${userId}/${historyId}`),
            {
              id: historyId,
              points: points,
              reason: "DEPOSIT_STRIPE",
              metadata: {
                transactionId,
                paymentIntentId: paymentIntent.id,
                amount: transaction.amount,
                currency: transaction.currency,
              },
              timestamp: new Date().toISOString(),
              previousPoints: currentPoints,
              newPoints: currentPoints + points,
              previousWalletAmount: currentWallet.amount || 0,
              newWalletAmount: (currentWallet.amount || 0) + points,
            }
          );
        } else {
          console.error(`User ${userId} not found`);
          await updateWithRetry(
            ref(database, `webhook_errors/stripe_${uuidv4()}`),
            {
              error: "User not found",
              eventId: event.id,
              transactionId,
              userId,
              timestamp: new Date().toISOString(),
            }
          );
          return res.status(404).json({ error: "User not found" });
        }
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        const subscription = event.data.object;
        const subscriptionStatus = subscription.status;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer;

        const subscriptionUserQuery = ref(database, "users");
        const subscriptionUserSnapshot = await get(
          query(
            subscriptionUserQuery,
            orderByChild("stripeCustomerId"),
            equalTo(customerId)
          )
        );
        if (subscriptionUserSnapshot.exists()) {
          const subUserId = Object.keys(subscriptionUserSnapshot.val())[0];
          await updateWithRetry(ref(database, `users/${subUserId}`), {
            subscriptionId,
            subscriptionStatus,
            updatedAt: new Date().toISOString(),
          });
        }
        break;

      default:
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing Stripe webhook:", {
      message: error.message,
      stack: error.stack,
    });
    await updateWithRetry(ref(database, `webhook_errors/stripe_${uuidv4()}`), {
      error: error.message,
      signature: sig,
      payloadLength: req.body.length,
      timestamp: new Date().toISOString(),
    });
    return res.status(400).json({ error: "Webhook error" });
  }
};

// M-Pesa webhook signature verification
const verifyMpesaWebhookSignature = (req, res, next) => {
  try {
    const signature = req.headers["x-mpesa-signature"];
    const timestamp = req.headers["x-mpesa-timestamp"];

    if (!signature || !timestamp) {
      console.warn("Missing M-Pesa webhook signature or timestamp");
      // For now, allow without signature verification but log the warning
      // In production, you should implement proper signature verification
      return next();
    }

    // TODO: Implement proper M-Pesa signature verification
    // This would involve creating a hash of the payload with your secret
    // and comparing it with the provided signature

    next();
  } catch (error) {
    console.error("M-Pesa webhook signature verification error:", error);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }
};

// M-Pesa webhook handler
const mpesaWebhook = async (req, res) => {
  let CheckoutRequestID = "unknown"; // Declare outside try block for error handling
  try {
    const { Body } = req.body;
    console.log("M-Pesa webhook payload", req.body);
    if (!Body || !Body.stkCallback) {
      console.error("Invalid M-Pesa webhook payload", { body: req.body });
      await updateWithRetry(ref(database, `webhook_errors/mpesa_${uuidv4()}`), {
        error: "Invalid webhook payload",
        timestamp: new Date().toISOString(),
      });
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const { stkCallback } = Body;
    const {
      CheckoutRequestID: requestId,
      ResultCode,
      ResultDesc,
    } = stkCallback;
    CheckoutRequestID = requestId; // Assign to outer scope variable

    const eventRef = ref(database, `webhook_events/mpesa_${CheckoutRequestID}`);
    const eventSnapshot = await get(eventRef);
    if (eventSnapshot.exists()) {
      return res.status(200).json({ received: true });
    }

    // Get all transactions and filter by checkoutRequestId to avoid index requirement
    const transactionsRef = ref(database, "transactions");
    const transactionSnapshot = await get(transactionsRef);
    const allTransactions = transactionSnapshot.val() || {};

    // Find transaction with matching checkoutRequestId
    let transactionId = null;
    let transaction = null;

    for (const [id, tx] of Object.entries(allTransactions)) {
      if (tx.checkoutRequestId === CheckoutRequestID) {
        transactionId = id;
        transaction = tx;
        break;
      }
    }

    if (!transaction) {
      console.error(
        `Transaction with CheckoutRequestID ${CheckoutRequestID} not found`
      );
      await updateWithRetry(ref(database, `webhook_errors/mpesa_${uuidv4()}`), {
        error: "Transaction not found",
        checkoutRequestId: CheckoutRequestID,
        timestamp: new Date().toISOString(),
      });
      return res.status(404).json({ error: "Transaction not found" });
    }

    await updateWithRetry(eventRef, {
      processed: true,
      type: "stkCallback",
      createdAt: new Date().toISOString(),
    });

    if (ResultCode === 0) {
      // Success
      await updateWithRetry(ref(database, `transactions/${transactionId}`), {
        status: "completed",
        updatedAt: new Date().toISOString(),
      });

      const userRef = ref(database, `users/${transaction.userId}`);
      const userSnapshot = await get(userRef);
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();
        const currentPoints = userData.points || 0;
        const currentWallet = userData.wallet || { amount: 0, currency: "KES" };
        const pointsToAdd =
          parseInt(transaction.pointsToAdd) || parseInt(transaction.amount);
        if (isNaN(pointsToAdd) || pointsToAdd <= 0) {
          console.error("Invalid pointsToAdd for M-Pesa transaction", {
            transactionId,
            pointsToAdd,
            amount: transaction.amount,
          });
          await updateWithRetry(
            ref(database, `webhook_errors/mpesa_${uuidv4()}`),
            {
              error: `Invalid pointsToAdd: ${pointsToAdd}`,
              checkoutRequestId: CheckoutRequestID,
              transactionId,
              timestamp: new Date().toISOString(),
            }
          );
          return res.status(400).json({ error: "Invalid pointsToAdd" });
        }

        // Update user points and wallet balance
        await updateWithRetry(userRef, {
          points: currentPoints + pointsToAdd,
          wallet: {
            ...currentWallet,
            amount: (currentWallet.amount || 0) + pointsToAdd, // Also add to wallet balance
            currency: "KES",
            lastUpdated: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        });

        // Record points history entry (idempotent per transaction)
        const historyId = `deposit_mpesa_${transactionId}`;
        await updateWithRetry(
          ref(database, `pointsHistory/${transaction.userId}/${historyId}`),
          {
            id: historyId,
            points: pointsToAdd,
            reason: "DEPOSIT_MPESA",
            metadata: {
              checkoutRequestId: CheckoutRequestID,
              transactionId,
              amount: transaction.amount,
              currency: transaction.currency,
            },
            timestamp: new Date().toISOString(),
            previousPoints: currentPoints,
            newPoints: currentPoints + pointsToAdd,
            previousWalletAmount: currentWallet.amount || 0,
            newWalletAmount: (currentWallet.amount || 0) + pointsToAdd,
          }
        );
      } else {
        console.error(`User ${transaction.userId} not found`);
        await updateWithRetry(
          ref(database, `webhook_errors/mpesa_${uuidv4()}`),
          {
            error: "User not found",
            checkoutRequestId: CheckoutRequestID,
            transactionId,
            timestamp: new Date().toISOString(),
          }
        );
        return res.status(404).json({ error: "User not found" });
      }
    } else {
      // Failed
      await updateWithRetry(ref(database, `transactions/${transactionId}`), {
        status: "failed",
        error: ResultDesc,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing M-Pesa webhook:", {
      message: error.message,
      stack: error.stack,
    });
    await updateWithRetry(ref(database, `webhook_errors/mpesa_${uuidv4()}`), {
      error: error.message,
      checkoutRequestId: CheckoutRequestID || "unknown",
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({ error: "Webhook error" });
  }
};

// Convert existing wallet balance to points
const convertWalletToPoints = async (req, res) => {
  const { userId } = req.body;

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ error: "Valid userId required" });
  }
  if (userId !== req.user.uid) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = snapshot.val();
    if (userData.pointsConverted) {
      return res
        .status(200)
        .json({ message: "Wallet already converted to points" });
    }

    const { amount, currency } = userData.wallet || {
      amount: 0,
      currency: "KES",
    };
    if (amount <= 0) {
      return res.status(200).json({ message: "No wallet balance to convert" });
    }

    // Convert wallet amount directly to points (1:1)
    const pointsToAdd = Math.round(amount);

    // Update user document
    await updateWithRetry(userRef, {
      points: (userData.points || 0) + pointsToAdd,
      wallet: { amount: 0, currency: "KES" },
      pointsConverted: true,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      message: `Converted ${amount} ${currency} to ${pointsToAdd} points`,
    });
  } catch (error) {
    console.error("Error converting wallet to points:", {
      message: error.message,
      stack: error.stack,
    });
    await updateWithRetry(ref(database, `webhook_errors/wallet_${uuidv4()}`), {
      error: `Failed to convert wallet: ${error.message}`,
      userId,
      timestamp: new Date().toISOString(),
    });
    return res
      .status(500)
      .json({ error: "Failed to convert wallet to points" });
  }
};

// Get user transactions
const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 10, type } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Get all transactions and filter on the server side for simplicity
    const transactionsRef = ref(database, "transactions");
    const transactionSnapshot = await get(transactionsRef);

    if (!transactionSnapshot.exists()) {
      return res.status(200).json({ transactions: [] });
    }

    const transactionsData = transactionSnapshot.val() || {};

    // Convert to array and filter by userId and type
    let transactions = Object.entries(transactionsData)
      .map(([id, tx]) => ({ id, ...tx }))
      .filter((tx) => tx.userId === userId);

    if (type) {
      transactions = transactions.filter((tx) => tx.type === type);
    }

    // Sort by creation date (newest first) and limit results
    transactions = transactions
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, parseInt(limit))
      .map((tx) => ({
        ...tx,
        pointsToAdd: tx.pointsToAdd || tx.amount || 0,
      }));

    return res.status(200).json({ transactions });
  } catch (error) {
    console.error("Error fetching user transactions:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
};

module.exports = {
  createStripePayment,
  createMpesaPayment,
  stripeWebhook,
  mpesaWebhook,
  verifyMpesaWebhookSignature,
  convertWalletToPoints,
  getUserTransactions,
  getStripeTransactionStatus,
};
