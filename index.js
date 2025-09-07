const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const postsRouter = require("./routes/posts");
const clansRouter = require("./routes/clans");
const usersRouter = require("./routes/users");
const eventsRouter = require("./routes/events");
const paymentRouter = require("./routes/payment");
const leaderboardRouter = require("./routes/leaderboard");
const contactRouter = require("./routes/contact");
const { stripeWebhook } = require("./controllers/payment");

// ✅ NEW: Import production-grade routes
const analyticsRouter = require("./routes/analytics");
const searchRouter = require("./routes/search");

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos (20 minutes)
    fieldSize: 10 * 1024 * 1024, // 10MB for fields
    parts: 10, // Max 10 parts (fields + files)
  },
});

// Apply CORS
app.use(
  cors({
    origin: [
      // Development URLs
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5000",
      // Production URLs (commented out for development)
      "https://hub.gametribe.com",
      "https://gametribe.com",
      "https://gt-server-mu.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-SSO-Token",
      "X-Community-Token",
    ],
    exposedHeaders: ["X-SSO-Token", "X-Community-Token"],
  })
);

// Define Stripe webhook route FIRST with raw parser
// Stripe webhook route FIRST
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    next();
  },
  stripeWebhook
);

// Apply global middleware AFTER webhook
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes
app.use("/api/posts", postsRouter);
app.use("/api/clans", clansRouter);
app.use("/api/users", usersRouter);
app.use("/api/events", eventsRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/contact", contactRouter);

// ✅ NEW: Mount production-grade routes
app.use("/api/analytics", analyticsRouter);
app.use("/api/search", searchRouter);

// Add auth route for cross-platform authentication
app.use("/api/auth", require("./routes/auth"));

// Open Graph unfurl endpoint using proper scraper
app.get("/api/og", async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    // Clean and validate URL
    targetUrl = decodeURIComponent(targetUrl);
    
    // Remove any HTML tags that might have been included
    targetUrl = targetUrl.replace(/<[^>]*>/g, '').trim();
    
    // Validate URL format
    if (!/^https?:\/\//i.test(targetUrl)) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Additional validation using URL constructor
    try {
      new URL(targetUrl);
    } catch (urlError) {
      return res.status(400).json({ error: "Invalid URL", details: urlError.message });
    }
    
    const ogScraper = require('./utils/ogScraper');
    const data = await ogScraper.scrape(targetUrl);
    res.json(data);
  } catch (e) {
    console.error("/api/og error", e.message);
    
    // Handle specific error types more gracefully
    if (e.message.includes('503') || e.message.includes('Service Unavailable')) {
      res.status(503).json({ 
        error: "Website temporarily unavailable", 
        details: "The target website is currently unavailable. Please try again later." 
      });
    } else if (e.message.includes('404') || e.message.includes('Not Found')) {
      res.status(404).json({ 
        error: "Page not found", 
        details: "The requested page could not be found." 
      });
    } else if (e.message.includes('403') || e.message.includes('Forbidden')) {
      res.status(403).json({ 
        error: "Access denied", 
        details: "Access to this website is forbidden." 
      });
    } else {
      res.status(500).json({ error: "Failed to unfurl url", details: e.message });
    }
  }
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working" });
});

// Test Firebase connection
app.get("/api/test-firebase", async (req, res) => {
  try {
    const { database } = require("./config/firebase");
    const testRef = database.ref("test");
    await testRef.set({ timestamp: new Date().toISOString() });
    const snapshot = await testRef.once("value");
    await testRef.remove();
    res.json({ message: "Firebase connection working", data: snapshot.val() });
  } catch (error) {
    console.error("Firebase test error:", error);
    res
      .status(500)
      .json({ error: "Firebase connection failed", details: error.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Server error:", {
    message: err.message,
    stack: err.stack,
  });
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  if (err.message === "Unexpected end of form") {
    return res
      .status(400)
      .json({ error: "Invalid multipart/form-data: Unexpected end of form" });
  }
  res.status(500).json({ error: "Internal server error" });
});

const PORT = 5000;
app.listen(PORT, () => {
  // Server started successfully
});
