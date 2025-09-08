const express = require("express");
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  getUserClans,
  followUser,
  unfollowUser,
  getFriends,
  getUserStatus,
  getUserById,
  updateUserStatus,
  syncPresence,
  updateUserCountry,
  // Friend Request System
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,
  cancelFriendRequest,
} = require("../controllers/users");
const authenticate = require("../middleware/auth");
const { verifyToken } = require("../middleware/authMiddleware");


router.get("/profile", authenticate, getUserProfile);
router.put("/profile", authenticate, updateUserProfile);
router.get("/clans", authenticate, getUserClans);
router.post("/:userId/follow", authenticate, followUser);
router.post("/:userId/unfollow", authenticate, unfollowUser);
router.get("/:userId/friends", authenticate, getFriends);
router.get("/:userId/status", authenticate, getUserStatus);
router.get("/:userId", authenticate, getUserById);
router.post("/update-status", authenticate, updateUserStatus);
router.post("/sync-presence", authenticate, syncPresence);
router.put("/country", authenticate, updateUserCountry);

// Friend Request System Routes
router.post("/:userId/send-friend-request", authenticate, sendFriendRequest);
router.post("/:userId/accept-friend-request", authenticate, acceptFriendRequest);
router.post("/:userId/reject-friend-request", authenticate, rejectFriendRequest);
router.post("/:userId/cancel-friend-request", authenticate, cancelFriendRequest);
router.get("/friend-requests", authenticate, getFriendRequests);

// GET endpoint for token verification (for cross-platform auth)
router.get('/verify', verifyToken, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      platform: 'community',
      server: 'gametribe-backend'
    }
  });
});

module.exports = router;
