const rateLimit = require('express-rate-limit');

// ✅ NEW: Rate limiting middleware for production-grade social platform

// Post creation rate limiter - prevent spam
const postCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 posts per windowMs
  message: {
    error: 'Too many posts created, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many posts created, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Like/unlike rate limiter - prevent abuse
const likeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 likes per minute
  message: {
    error: 'Too many likes, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many likes, please slow down.',
      retryAfter: '1 minute'
    });
  }
});

// Comment creation rate limiter
const commentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each IP to 20 comments per 5 minutes
  message: {
    error: 'Too many comments created, please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many comments created, please try again later.',
      retryAfter: '5 minutes'
    });
  }
});

// Repost rate limiter
const repostLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 reposts per 10 minutes
  message: {
    error: 'Too many reposts, please try again later.',
    retryAfter: '10 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many reposts, please try again later.',
      retryAfter: '10 minutes'
    });
  }
});

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Strict rate limiter for sensitive operations
const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per hour
  message: {
    error: 'Too many sensitive operations, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many sensitive operations, please try again later.',
      retryAfter: '1 hour'
    });
  }
});

module.exports = {
  postCreationLimiter,
  likeLimiter,
  commentLimiter,
  repostLimiter,
  generalLimiter,
  strictLimiter
};