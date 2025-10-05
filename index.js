const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");

// Import new performance modules
const {
  noLimiter,
  devLimiter,
  generalLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  searchLimiter,
  webhookLimiter,
} = require("./middleware/rateLimiter");

// Import new middleware
const { sanitizeContent } = require("./middleware/contentSanitizer");
const {
  upload,
  handleFileValidationError,
} = require("./middleware/fileValidator");
const {
  validateUrlMiddleware,
  rateLimitOgRequests,
  getCachedOgData,
  setCachedOgData,
} = require("./middleware/urlValidator");
const { processRequestData } = require("./middleware/dataProcessor");
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
const gameScoresRouter = require("./routes/gameScores");
const gameReviewsRouter = require("./routes/gameReviews");
const gamesRouter = require("./routes/games");
const challengeRouter = require("./routes/challenges");
const notificationRouter = require("./routes/notifications");
const walletRouter = require("./routes/wallet");

const app = express();

// Rate limiting for Nominatim API calls
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 requests per minute per IP

const checkRateLimit = (ip) => {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];

  // Remove old requests outside the window
  const recentRequests = userRequests.filter(
    (time) => now - time < RATE_LIMIT_WINDOW
  );

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }

  // Add current request
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);

  return true; // Request allowed
};

// upload is already imported from fileValidator middleware

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

// Apply general rate limiting (noLimiter for development, devLimiter for production)
const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV !== "production";
const generalRateLimiter = isDevelopment ? noLimiter : devLimiter;

console.log(
  `🔧 Rate limiting mode: ${
    isDevelopment ? "DISABLED (development)" : "ENABLED (production)"
  }`
);
app.use(generalRateLimiter);

// Define Stripe webhook route FIRST with raw parser
// Stripe webhook route FIRST
app.post(
  "/api/payments/stripe/webhook",
  isDevelopment ? noLimiter : webhookLimiter,
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    console.log("🚀 Stripe webhook route hit");
    console.log("📋 Request headers:", req.headers);
    console.log("📦 Body type:", typeof req.body);
    console.log("📦 Body length:", req.body?.length || 0);
    console.log(
      "📦 Body hex preview:",
      req.body?.toString("hex").substring(0, 200) + "..."
    );
    next();
  },
  stripeWebhook
);

// Test webhook endpoint
app.post("/api/payments/stripe/test-webhook", (req, res) => {
  console.log("🧪 Test webhook endpoint hit");
  console.log("📋 Headers:", req.headers);
  console.log("📦 Body:", req.body);
  res.json({
    message: "Test webhook received",
    timestamp: new Date().toISOString(),
  });
});

// Apply global middleware AFTER webhook
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount routes with conditional rate limiting
app.use("/api/posts", postsRouter);
app.use("/api/clans", clansRouter);
app.use("/api/users", usersRouter);
app.use("/api/events", eventsRouter);
app.use(
  "/api/payments",
  isDevelopment ? noLimiter : paymentLimiter,
  paymentRouter
);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/contact", contactRouter);

// ✅ NEW: Mount production-grade routes with conditional rate limiting
app.use("/api/analytics", analyticsRouter);
app.use("/api/search", isDevelopment ? noLimiter : searchLimiter, searchRouter);
app.use("/api/game-scores", gameScoresRouter);
app.use("/api/game-reviews", gameReviewsRouter);
app.use("/api/games", gamesRouter);
app.use("/api/challenges", challengeRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/wallet", walletRouter);

// Add auth route for cross-platform authentication with conditional rate limiting
app.use(
  "/api/auth",
  isDevelopment ? noLimiter : authLimiter,
  require("./routes/auth")
);

// Open Graph unfurl endpoint using proper scraper with new middleware
app.get(
  "/api/og",
  isDevelopment ? noLimiter : searchLimiter,
  rateLimitOgRequests,
  validateUrlMiddleware,
  async (req, res) => {
    try {
      const targetUrl = req.validatedUrl;

      // Check cache first
      const cached = getCachedOgData(targetUrl);
      if (cached) {
        return res.json({
          ...cached,
          cached: true,
        });
      }

      const ogScraper = require("./utils/ogScraper");

      // Cache the result
      setCachedOgData(targetUrl, data);

      res.json({
        ...data,
        cached: false,
      });
    } catch (e) {
      console.error("/api/og error", e.message);

      // Handle specific error types more gracefully
      if (
        e.message.includes("503") ||
        e.message.includes("Service Unavailable")
      ) {
        res.status(503).json({
          error: "Website temporarily unavailable",
          details:
            "The target website is currently unavailable. Please try again later.",
        });
      } else if (e.message.includes("404") || e.message.includes("Not Found")) {
        res.status(404).json({
          error: "Page not found",
          details: "The requested page could not be found.",
        });
      } else if (e.message.includes("403") || e.message.includes("Forbidden")) {
        res.status(403).json({
          error: "Access denied",
          details: "Access to this website is forbidden.",
        });
      } else {
        res
          .status(500)
          .json({ error: "Failed to unfurl url", details: e.message });
      }
    }
  }
);

// OpenStreetMap Nominatim API endpoint (Free alternative to Google Places)
app.get(
  "/api/places/search",
  isDevelopment ? noLimiter : searchLimiter,
  async (req, res) => {
    try {
      const { query, lat, lng } = req.query;
      const clientIP = req.ip || req.connection.remoteAddress || "unknown";

      // Check rate limit
      if (!checkRateLimit(clientIP)) {
        return res.status(429).json({
          error: "Rate limit exceeded",
          message:
            "Too many requests. Please wait a moment before searching again.",
        });
      }

      if (!query || query.length < 3) {
        console.log("Query validation failed:", {
          query,
          length: query?.length,
        });
        return res
          .status(400)
          .json({ error: "Query must be at least 3 characters long" });
      }

      console.log("Places search request:", {
        query,
        lat,
        lng,
        queryLength: query.length,
        clientIP,
      });

      // Build Nominatim API URL with optional location bias
      let apiUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=5&addressdetails=1&extratags=1`;

      // Add location bias if coordinates are provided (prioritize nearby results)
      if (lat && lng) {
        // Use viewbox for location bias but don't restrict results to only within the box
        const latOffset = 0.5; // ~55km radius
        const lngOffset = 0.5; // ~55km radius
        const minLon = parseFloat(lng) - lngOffset;
        const minLat = parseFloat(lat) - latOffset;
        const maxLon = parseFloat(lng) + lngOffset;
        const maxLat = parseFloat(lat) + latOffset;
        const viewbox = `${minLon},${minLat},${maxLon},${maxLat}`;
        apiUrl += `&viewbox=${viewbox}`; // No bounded=1 to allow results outside the box
      }

      // Debug: Log the API URL being called
      console.log("Nominatim API URL:", apiUrl);

      // Add a small delay to be respectful to Nominatim API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Use OpenStreetMap Nominatim API (completely free, no billing required)
      // Add proper headers to comply with Nominatim usage policy
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "GameTribe-Community/1.0 (https://gametribe-backend.onrender.com)",
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        console.error(
          "Nominatim API error:",
          response.status,
          response.statusText
        );
        const errorText = await response.text();
        console.error("Nominatim API error response:", errorText);

        // If we get a 403 (blocked), provide a fallback response
        if (response.status === 403) {
          console.log("Nominatim API blocked, providing fallback suggestions");
          return res.json({
            suggestions: [
              {
                id: "fallback-1",
                name: query,
                address: `${query}, Kenya`,
                location: {
                  lat: lat ? parseFloat(lat) : -1.1544312,
                  lng: lng ? parseFloat(lng) : 36.9650841,
                },
              },
            ],
          });
        }

        throw new Error(
          `Nominatim API error: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data && data.length > 0) {
        let suggestions = data.map((place) => ({
          id: place.place_id || place.osm_id,
          name: place.display_name.split(",")[0] || place.name || "Unknown",
          address: place.display_name,
          location: {
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
          },
        }));

        // Sort by distance if user location is provided
        if (lat && lng) {
          const userLat = parseFloat(lat);
          const userLng = parseFloat(lng);

          // Calculate distance using Haversine formula
          const calculateDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth's radius in kilometers
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // Distance in kilometers
          };

          // Add distance to each suggestion and sort by distance
          suggestions = suggestions
            .map((suggestion) => ({
              ...suggestion,
              distance: calculateDistance(
                userLat,
                userLng,
                suggestion.location.lat,
                suggestion.location.lng
              ),
            }))
            .sort((a, b) => a.distance - b.distance);

          // Debug: Log sorted suggestions with distances
          console.log(
            "Sorted suggestions by distance:",
            suggestions.map((s) => ({
              name: s.name,
              address: s.address,
              distance: `${s.distance.toFixed(2)}km`,
            }))
          );

          // Remove distance from final response (keep it internal)
          suggestions = suggestions.map(
            ({ distance, ...suggestion }) => suggestion
          );
        }

        res.json({ suggestions });
      } else {
        res.status(400).json({
          error: "No results found",
          message: "No places found for the given query",
        });
      }
    } catch (error) {
      console.error("Nominatim API error:", error);
      res.status(500).json({
        error: "Failed to search places",
        details: error.message,
      });
    }
  }
);

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

// Add file validation error handler
app.use(handleFileValidationError);

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🗄️ Database: Firebase (default)`);
      console.log(`💾 Cache: In-memory (efficient)`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
