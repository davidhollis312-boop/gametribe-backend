const express = require("express");
const router = express.Router();

/**
 * Test Routes
 * For deployment verification
 */

// Simple health check
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "✅ Backend is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    features: {
      security: "enabled",
      sessionTokens: "active",
      rateLimit: "enforced",
      encryption: process.env.CHALLENGE_ENCRYPTION_KEY ? "configured" : "not configured",
    },
  });
});

// Detailed system check
router.get("/system", (req, res) => {
  res.json({
    success: true,
    system: {
      node: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
      },
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      encryption: process.env.CHALLENGE_ENCRYPTION_KEY ? "✅ Set" : "❌ Not set",
      mobileSecret: process.env.MOBILE_APP_SECRET ? "✅ Set" : "❌ Not set",
      firebase: process.env.FIREBASE_CONFIG ? "✅ Functions" : "⚠️ Local",
    },
    features: {
      authentication: "Firebase Auth",
      database: "Firebase Realtime Database",
      storage: "Firebase Storage",
      payments: "Stripe + M-Pesa",
      challenges: "Session Tokens + Atomic Transactions",
      security: "Rate Limiting + Error Sanitization",
    },
  });
});

// Firebase Functions check
router.get("/firebase", (req, res) => {
  const isFirebase = process.env.FUNCTION_NAME || process.env.FIREBASE_CONFIG;
  
  res.json({
    success: true,
    deployment: {
      platform: isFirebase ? "Firebase Functions" : "Local/Other",
      functionName: process.env.FUNCTION_NAME || "N/A",
      region: process.env.FUNCTION_REGION || "N/A",
      project: process.env.GCLOUD_PROJECT || "N/A",
    },
    status: isFirebase ? "✅ Running on Firebase" : "⚠️ Running locally",
  });
});

// Echo request (for debugging)
router.post("/echo", (req, res) => {
  res.json({
    success: true,
    received: {
      body: req.body,
      headers: {
        "content-type": req.get("content-type"),
        authorization: req.get("authorization") ? "Present (hidden)" : "Not present",
        origin: req.get("origin") || "No origin",
      },
      method: req.method,
      path: req.path,
    },
  });
});

module.exports = router;


