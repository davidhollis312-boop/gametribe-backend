const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

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