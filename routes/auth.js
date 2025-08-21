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

// POST endpoint for SSO authentication from main platform
router.post('/sso', async (req, res) => {
  try {
    const { token, user_data, source } = req.body;
    
    if (!token || !user_data) {
      return res.status(400).json({ 
        error: "Missing required fields: token and user_data" 
      });
    }
    
    // Verify the token with Firebase Admin
    const { auth } = require("../config/firebase");
    const decodedToken = await auth.verifyIdToken(token);
    
    // Validate that the user data matches the token
    if (decodedToken.uid !== user_data.uid) {
      return res.status(403).json({ 
        error: "Token user ID does not match provided user data" 
      });
    }
    
    // Generate a custom token for Firebase client authentication
    const customToken = await auth.createCustomToken(decodedToken.uid);
    
    // Return success with user data and custom token
    res.json({
      success: true,
      data: {
        user: user_data,
        platform: 'community',
        server: 'gametribe-backend',
        source: source || 'main-platform',
        authenticated: true,
        customToken: customToken
      }
    });
    
    console.log(`✅ SSO authentication successful for user: ${user_data.email} from ${source || 'main-platform'}`);
    
  } catch (error) {
    console.error('SSO authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: "Token expired", 
        code: "TOKEN_EXPIRED" 
      });
    } else if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({ 
        error: "Token revoked", 
        code: "TOKEN_REVOKED" 
      });
    } else if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ 
        error: "Invalid token", 
        code: "INVALID_TOKEN" 
      });
    }
    
    res.status(500).json({ 
      error: "Authentication failed", 
      details: error.message 
    });
  }
});

// GET endpoint for SSO status check
router.get('/sso/status', (req, res) => {
  const ssoToken = req.query.sso_token;
  const userData = req.query.user_data;
  
  if (!ssoToken || !userData) {
    return res.json({
      success: false,
      data: {
        authenticated: false,
        message: "Missing SSO parameters"
      }
    });
  }
  
  try {
    const user = JSON.parse(decodeURIComponent(userData));
    res.json({
      success: true,
      data: {
        authenticated: true,
        user: user,
        source: 'main-platform'
      }
    });
  } catch (error) {
    res.json({
      success: false,
      data: {
        authenticated: false,
        message: "Invalid user data format"
      }
    });
  }
});

module.exports = router; 