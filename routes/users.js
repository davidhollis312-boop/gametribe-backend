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
} = require("../controllers/users");
const authenticate = require("../middleware/auth");



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

module.exports = router;
