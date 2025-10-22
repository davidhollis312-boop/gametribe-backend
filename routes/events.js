const express = require("express");
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  bookEvent,
  cancelBooking,
  getEventBookings,
  getEventComments,
  createEventComment,
  createEventReply,
  likeEventComment,
  likeEventReply,
  likeEvent,
  getUserEventBookings,
  getUserBookings,
  getCreatedEvents,
  contactBooker,
} = require("../controllers/events");
const authenticate = require("../middleware/auth");
const multer = require("multer");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    fieldSize: 10 * 1024 * 1024, // 10MB for fields
    parts: 20, // Max 20 parts (increased for location fields)
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG/PNG images are allowed"));
  },
});

// Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("❌ Multer Error:", err.message, err.code);
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 5MB." });
    }
    if (err.code === "LIMIT_FIELD_SIZE") {
      return res.status(400).json({ error: "Field data too large." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "Unexpected file field." });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    console.error("❌ Upload Error:", err.message);
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Public routes
router.get("/", getEvents);
router.get("/:id", getEventById);
router.get("/:id/bookings", getEventBookings);
router.get("/:id/comments", getEventComments);

// Protected routes
router.post(
  "/",
  authenticate,
  upload.single("image"),
  handleMulterError,
  createEvent
);
router.put("/:id", authenticate, upload.single("image"), updateEvent);
router.delete("/:id", authenticate, deleteEvent);
router.post("/:id/book", authenticate, bookEvent);
router.delete("/:id/book", authenticate, cancelBooking);
router.get("/user/bookings", authenticate, getUserEventBookings);
router.get("/user/my-bookings", authenticate, getUserBookings);
router.get("/user/created-events", authenticate, getCreatedEvents);
router.post("/contact-booker", authenticate, contactBooker);
router.post(
  "/:id/comments",
  authenticate,
  upload.single("attachment"),
  createEventComment
);
router.post(
  "/:id/comments/:commentId/replies",
  authenticate,
  upload.single("attachment"),
  createEventReply
);
router.put("/:id/comments/:commentId/like", authenticate, likeEventComment);
router.put(
  "/:id/comments/:commentId/replies/:replyId/like",
  authenticate,
  likeEventReply
);
router.post("/:id/like", authenticate, likeEvent);

module.exports = router;
