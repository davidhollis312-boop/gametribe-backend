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

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

// Add auth route for cross-platform authentication
app.use("/api/auth", require("./routes/auth"));

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
