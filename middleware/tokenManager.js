const jwt = require("jsonwebtoken");
const { auth } = require("../config/firebase");

/**
 * Secure Token Management Middleware
 * Handles JWT token creation, validation, and refresh
 */

// JWT configuration
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || "your-secret-key",
  expiresIn: "24h",
  refreshExpiresIn: "7d",
  issuer: "gametribe-community",
  audience: "gametribe-users",
};

/**
 * Generate JWT token
 */
const generateToken = (payload) => {
  try {
    const tokenPayload = {
      uid: payload.uid,
      email: payload.email,
      displayName: payload.displayName,
      photoURL: payload.photoURL,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
      iss: JWT_CONFIG.issuer,
      aud: JWT_CONFIG.audience,
    };

    return jwt.sign(tokenPayload, JWT_CONFIG.secret, {
      expiresIn: JWT_CONFIG.expiresIn,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
  } catch (error) {
    console.error("Error generating JWT token:", error);
    throw new Error("Token generation failed");
  }
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  try {
    const refreshPayload = {
      uid: payload.uid,
      type: "refresh",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      iss: JWT_CONFIG.issuer,
      aud: JWT_CONFIG.audience,
    };

    return jwt.sign(refreshPayload, JWT_CONFIG.secret, {
      expiresIn: JWT_CONFIG.refreshExpiresIn,
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });
  } catch (error) {
    console.error("Error generating refresh token:", error);
    throw new Error("Refresh token generation failed");
  }
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });

    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    } else {
      throw new Error("Token verification failed");
    }
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience,
    });

    // Check if it's a refresh token
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    // Check if token is expired
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Refresh token expired");
    }

    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Refresh token expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid refresh token");
    } else {
      throw new Error("Refresh token verification failed");
    }
  }
};

/**
 * Refresh JWT token using refresh token
 */
const refreshToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get fresh user data from Firebase
    const userRecord = await auth.getUser(decoded.uid);

    // Generate new tokens
    const newToken = generateToken({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
    });

    const newRefreshToken = generateRefreshToken({
      uid: userRecord.uid,
    });

    return {
      token: newToken,
      refreshToken: newRefreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  } catch (error) {
    console.error("Error refreshing token:", error);
    throw new Error("Token refresh failed");
  }
};

/**
 * Extract token from request headers
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

/**
 * Middleware to validate JWT token
 */
const validateToken = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: "No token provided",
        message: "Authorization header with Bearer token is required",
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user data from Firebase
    const userRecord = await auth.getUser(decoded.uid);

    // Add user data to request
    req.user = {
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      photoURL: userRecord.photoURL,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      customClaims: userRecord.customClaims,
    };

    next();
  } catch (error) {
    console.error("Token validation error:", error);

    if (error.message === "Token expired") {
      return res.status(401).json({
        error: "Token expired",
        message: "Please refresh your token",
      });
    } else if (error.message === "Invalid token") {
      return res.status(401).json({
        error: "Invalid token",
        message: "Please provide a valid token",
      });
    } else {
      return res.status(401).json({
        error: "Authentication failed",
        message: "Token validation failed",
      });
    }
  }
};

/**
 * Middleware to validate refresh token
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token required",
        message: "Please provide a refresh token",
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Add user ID to request
    req.userId = decoded.uid;

    next();
  } catch (error) {
    console.error("Refresh token validation error:", error);

    if (error.message === "Refresh token expired") {
      return res.status(401).json({
        error: "Refresh token expired",
        message: "Please log in again",
      });
    } else {
      return res.status(401).json({
        error: "Invalid refresh token",
        message: "Please provide a valid refresh token",
      });
    }
  }
};

/**
 * Middleware to validate Firebase ID token
 */
const validateFirebaseToken = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: "No token provided",
        message: "Authorization header with Bearer token is required",
      });
    }

    // Verify Firebase ID token
    const decodedToken = await auth.verifyIdToken(token);

    // Add user data to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      photoURL: decodedToken.picture,
      emailVerified: decodedToken.email_verified,
      customClaims: decodedToken,
    };

    next();
  } catch (error) {
    console.error("Firebase token validation error:", error);

    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({
        error: "Token expired",
        message: "Please refresh your token",
      });
    } else if (error.code === "auth/invalid-id-token") {
      return res.status(401).json({
        error: "Invalid token",
        message: "Please provide a valid token",
      });
    } else {
      return res.status(401).json({
        error: "Authentication failed",
        message: "Token validation failed",
      });
    }
  }
};

/**
 * Generate token pair (access + refresh)
 */
const generateTokenPair = async (userData) => {
  try {
    const token = generateToken(userData);
    const refreshToken = generateRefreshToken(userData);

    return {
      token,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
      tokenType: "Bearer",
    };
  } catch (error) {
    console.error("Error generating token pair:", error);
    throw new Error("Token generation failed");
  }
};

/**
 * Revoke token (add to blacklist)
 */
const revokeToken = (token) => {
  try {
    // In a production environment, you would add the token to a blacklist
    // For now, we'll just log the revocation
    console.log("Token revoked:", token.substring(0, 20) + "...");
    return true;
  } catch (error) {
    console.error("Error revoking token:", error);
    return false;
  }
};

/**
 * Check if token is blacklisted
 */
const isTokenBlacklisted = (token) => {
  // In a production environment, you would check against a blacklist
  // For now, we'll return false (not blacklisted)
  return false;
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  refreshToken,
  extractToken,
  validateToken,
  validateRefreshToken,
  validateFirebaseToken,
  generateTokenPair,
  revokeToken,
  isTokenBlacklisted,
  JWT_CONFIG,
};
