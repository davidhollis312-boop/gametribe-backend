const express = require("express");
const router = express.Router();
const { validateFirebaseToken } = require("../middleware/tokenManager");
const { database } = require("../config/firebase");

// Get reviews for a specific game
router.get("/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { limit = 50 } = req.query;

    const reviewsRef = database.ref(`gameReviews/${gameId}`);
    const snapshot = await reviewsRef
      .orderByChild("createdAt")
      .limitToLast(parseInt(limit))
      .once("value");

    if (!snapshot.exists()) {
      return res.json({ reviews: [], averageRating: 0, totalReviews: 0 });
    }

    const reviewsData = snapshot.val();
    const reviews = Object.entries(reviewsData).map(([id, review]) => ({
      id,
      ...review,
    }));

    // Sort by newest first
    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating =
      reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    res.json({
      reviews,
      averageRating: parseFloat(averageRating),
      totalReviews: reviews.length,
    });
  } catch (error) {
    console.error("Error fetching game reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// Submit a review for a game
router.post("/:gameId", validateFirebaseToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.uid;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    if (comment && comment.length > 500) {
      return res
        .status(400)
        .json({ error: "Comment must be 500 characters or less" });
    }

    // Get user data
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val() || {};

    const reviewData = {
      userId,
      userName: userData.username || userData.displayName || "Anonymous",
      userAvatar: userData.avatar || userData.photoURL || "",
      rating: parseInt(rating),
      comment: comment || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check if user already reviewed this game
    const userReviewRef = database.ref(`gameReviews/${gameId}/${userId}`);
    const existingReview = await userReviewRef.once("value");

    if (existingReview.exists()) {
      // Update existing review
      await userReviewRef.update({
        rating: reviewData.rating,
        comment: reviewData.comment,
        updatedAt: reviewData.updatedAt,
      });
      return res.json({
        message: "Review updated successfully",
        review: reviewData,
      });
    } else {
      // Create new review
      await userReviewRef.set(reviewData);
      return res.json({
        message: "Review submitted successfully",
        review: reviewData,
      });
    }
  } catch (error) {
    console.error("Error submitting review:", error);
    res.status(500).json({ error: "Failed to submit review" });
  }
});

// Delete a review
router.delete("/:gameId", validateFirebaseToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.uid;

    const reviewRef = database.ref(`gameReviews/${gameId}/${userId}`);
    const snapshot = await reviewRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "Review not found" });
    }

    await reviewRef.remove();
    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
});

module.exports = router;
