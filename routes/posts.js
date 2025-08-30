const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticate = require("../middleware/auth");
const {
  getPosts,
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
} = require("../controllers/post");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", getPosts);
router.post("/", authenticate, upload.single("image"), createPost);
router.put("/:postId", authenticate, upload.single("image"), updatePost);
router.delete("/:postId", authenticate, deletePost);
router.post("/:id/like", authenticate, likePost);
router.post("/:postId/repost", authenticate, repostPost);
router.delete("/:postId/repost", authenticate, unrepostPost);
router.get("/:postId/repost-chain", getRepostChain);
router.get("/:postId/comments", getComments);
router.post(
  "/:postId/comments",
  authenticate,
  upload.single("attachment"),
  (req, res, next) => {
    next();
  },
  createComment
);
router.post(
  "/:postId/comments/:commentId/replies",
  authenticate,
  upload.single("attachment"),
  (req, res, next) => {

    next();
  },
  createReply
);
router.put("/:postId/comments/:commentId/like", authenticate, likeComment);
router.put(
  "/:postId/comments/:commentId/replies/:replyId/like",
  authenticate,
  likeReply
);

module.exports = router;
