const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticate = require("../middleware/auth");
const {
  postCreationLimiter,
  likeLimiter,
  commentLimiter,
  repostLimiter,
  generalLimiter,
} = require("../middleware/rateLimiter");
const {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  likePost,
  getComments,
  createComment,
  createReply,
  likeComment,
  likeReply,
  repostPost,
  unrepostPost,
  getRepostChain,
  getReposts, // ✅ NEW: Import the new getReposts function
  cleanupOrphanedData, // ✅ NEW: Import cleanup function
} = require("../controllers/post");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", generalLimiter, getPosts);
router.get("/:postId", authenticate, getPost);
router.post(
  "/",
  authenticate,
  postCreationLimiter,
  upload.single("image"),
  createPost
);
router.put(
  "/:postId",
  authenticate,
  postCreationLimiter,
  upload.single("image"),
  updatePost
);
router.delete("/:postId", authenticate, deletePost);
router.post("/:id/like", authenticate, likeLimiter, likePost);
router.post("/:postId/repost", authenticate, repostLimiter, repostPost);
router.delete("/:postId/repost", authenticate, repostLimiter, unrepostPost);
router.get("/:postId/repost-chain", getRepostChain);
router.get("/:postId/reposts", getReposts); // ✅ NEW: Get reposts of a specific post
router.get("/:postId/comments", getComments);
router.post("/cleanup-orphaned", authenticate, cleanupOrphanedData); // ✅ NEW: Cleanup orphaned data
router.post(
  "/:postId/comments",
  authenticate,
  commentLimiter,
  upload.single("attachment"),
  (req, res, next) => {
    next();
  },
  createComment
);
router.post(
  "/:postId/comments/:commentId/replies",
  authenticate,
  commentLimiter,
  upload.single("attachment"),
  (req, res, next) => {
    next();
  },
  createReply
);
router.put(
  "/:postId/comments/:commentId/like",
  authenticate,
  likeLimiter,
  likeComment
);
router.put(
  "/:postId/comments/:commentId/replies/:replyId/like",
  authenticate,
  likeLimiter,
  likeReply
);

module.exports = router;
