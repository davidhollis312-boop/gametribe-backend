/**
 * Error handling middleware
 * Sanitizes error messages for production
 */

const NODE_ENV = process.env.NODE_ENV || "development";
const isDevelopment = NODE_ENV === "development";

/**
 * Sanitize error for client response
 */
const sanitizeError = (error) => {
  if (isDevelopment) {
    // In development, return full error details
    return {
      error: error.name || "Error",
      message: error.message || "An error occurred",
      stack: error.stack,
      details: error.details || null,
    };
  }

  // In production, return generic error
  const publicErrors = [
    "ValidationError",
    "AuthenticationError",
    "AuthorizationError",
    "NotFoundError",
    "RateLimitError",
  ];

  if (publicErrors.includes(error.name)) {
    return {
      error: error.name,
      message: error.message,
    };
  }

  // Generic error for everything else
  return {
    error: "Internal Server Error",
    message: "An unexpected error occurred. Please try again later.",
  };
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log full error server-side (always)
  console.error("❌ Server Error:", {
    path: req.path,
    method: req.method,
    userId: req.user?.uid,
    error: err.message,
    stack: isDevelopment ? err.stack : "(hidden in production)",
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Send sanitized error to client
  const sanitized = sanitizeError(err);

  res.status(statusCode).json(sanitized);
};

/**
 * Create standardized error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, name = "Error", details = null) {
    super(message);
    this.name = name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async error wrapper (catches async errors)
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  sanitizeError,
  AppError,
  asyncHandler,
};
