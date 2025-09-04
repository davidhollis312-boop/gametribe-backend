const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");
const monitoringService = require("../services/monitoring");
const { generalLimiter } = require("../middleware/rateLimiter");

// ✅ NEW: Analytics and monitoring routes

// Get analytics data
router.get("/", authenticate, generalLimiter, async (req, res) => {
  try {
    const { timeRange = '24h' } = req.query;
    const analytics = await monitoringService.getAnalytics(timeRange);
    
    res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error("Error getting analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get analytics"
    });
  }
});

// Get Prometheus metrics
router.get("/metrics", generalLimiter, async (req, res) => {
  try {
    const metrics = await monitoringService.getMetrics();
    res.set('Content-Type', 'text/plain');
    res.status(200).send(metrics);
  } catch (error) {
    console.error("Error getting metrics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get metrics"
    });
  }
});

// Health check endpoint
router.get("/health", generalLimiter, async (req, res) => {
  try {
    const health = await monitoringService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      ...health
    });
  } catch (error) {
    console.error("Error checking health:", error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get system statistics
router.get("/stats", authenticate, generalLimiter, async (req, res) => {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version,
        platform: process.platform
      },
      cache: await monitoringService.cacheService?.getStats() || null,
      search: await monitoringService.searchService?.getSearchStats() || null
    };
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get statistics"
    });
  }
});

module.exports = router;