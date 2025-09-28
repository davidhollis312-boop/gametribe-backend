const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const {
  createStripePayment,
  createStripeCheckoutSession,
  createMpesaPayment,
  mpesaWebhook,
  stripeWebhook,
  verifyMpesaWebhookSignature,
  convertWalletToPoints,
  getUserTransactions,
  getStripeTransactionStatus,
} = require("../controllers/payment");
const authenticate = require("../middleware/auth");

// Rate limiting for payment endpoints
const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 payment requests per windowMs (increased for development)
  message: {
    error: "Too many payment attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 webhook requests per minute
  message: {
    error: "Too many webhook requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Payment routes with rate limiting
router.post("/stripe", paymentRateLimit, authenticate, createStripePayment);
router.post(
  "/stripe/checkout",
  paymentRateLimit,
  authenticate,
  createStripeCheckoutSession
);
router.post("/mpesa", paymentRateLimit, authenticate, createMpesaPayment);
router.post(
  "/mpesa/webhook",
  webhookRateLimit,
  verifyMpesaWebhookSignature,
  mpesaWebhook
);
// Stripe webhook is handled directly in index.js with raw body parser
router.post(
  "/convert-wallet-to-points",
  paymentRateLimit,
  authenticate,
  convertWalletToPoints
);

// Transaction routes
router.get("/transactions", authenticate, getUserTransactions);
router.get(
  "/stripe/status/:transactionId",
  authenticate,
  getStripeTransactionStatus
);

module.exports = router;
