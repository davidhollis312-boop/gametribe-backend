const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/authMiddleware");
const {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotificationCount,
} = require("../controllers/notificationController");

/**
 * Notification Routes
 * All routes require authentication
 */

// Get user notifications
router.get("/", authenticateToken, getUserNotifications);

// Get notification count for navbar
router.get("/count", authenticateToken, getNotificationCount);

// Mark notification as read
router.put("/:notificationId/read", authenticateToken, markNotificationAsRead);

// Mark all notifications as read
router.put("/read-all", authenticateToken, markAllNotificationsAsRead);

// Delete specific notification
router.delete("/:notificationId", authenticateToken, deleteNotification);

// Clear all notifications
router.delete("/", authenticateToken, clearAllNotifications);

module.exports = router;

