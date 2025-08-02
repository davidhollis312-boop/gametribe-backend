const express = require("express");
const router = express.Router();
const multer = require("multer");
const authenticate = require("../middleware/auth");
const {
  getPosts,
  createPost,
  likePost,
  getComments,
  createComment,
  createReply,
  likeComment,
  likeReply,
} = require("../controllers/post");

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get("/", getPosts);
router.post("/", authenticate, upload.single("image"), createPost);
router.post("/:id/like", authenticate, likePost);
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
