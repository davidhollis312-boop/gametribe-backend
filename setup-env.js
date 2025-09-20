#!/usr/bin/env node

/**
 * Environment Setup Script for GameTribe Community Backend
 *
 * This script helps you create a .env file with all required environment variables.
 * Run: node setup-env.js
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const envTemplate = `# GameTribe Community Backend Environment Configuration
# Generated on ${new Date().toISOString()}

# =============================================================================
# CORE CONFIGURATION
# =============================================================================

# Node Environment (development, production, test)
NODE_ENV=development

# Server Configuration
PORT=5000

# =============================================================================
# FIREBASE CONFIGURATION (REQUIRED)
# =============================================================================

# Firebase Project Configuration
FIREBASE_PROJECT_ID=gametibe2025
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@gametibe2025.iam.gserviceaccount.com

# Firebase Storage Configuration
FIREBASE_STORAGE_BUCKET=gametibe2025.appspot.com
GOOGLE_CLOUD_STORAGE_BUCKET=gametibe2025.appspot.com

# =============================================================================
# STRIPE PAYMENT CONFIGURATION (REQUIRED)
# =============================================================================

# Stripe API Keys (use test keys for development, live keys for production)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# =============================================================================
# EMAIL SERVICE CONFIGURATION (OPTIONAL)
# =============================================================================

# Email Service Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password_here

# =============================================================================
# CACHING & PERFORMANCE (OPTIONAL)
# =============================================================================

# Note: Caching is now handled by in-memory cache service
# No external cache configuration needed

# =============================================================================
# MONITORING & ANALYTICS (OPTIONAL)
# =============================================================================

# Sentry Error Tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# AI Content Moderation
AI_MODERATION_ENABLED=false
AI_MODERATION_ENDPOINT=https://your-ai-service.com/moderate
AI_MODERATION_API_KEY=your_ai_api_key_here

# =============================================================================
# M-PESA PAYMENT CONFIGURATION (OPTIONAL - Kenya only)
# =============================================================================

# M-Pesa Configuration (Kenya mobile payments)
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_SHORTCODE=123456
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback

# =============================================================================
# STORAGE CONFIGURATION (OPTIONAL)
# =============================================================================

# Fallback Storage (when Firebase Storage is unavailable)
FALLBACK_STORAGE_URL=http://localhost:5000/uploads

# =============================================================================
# CORS & SECURITY CONFIGURATION (OPTIONAL)
# =============================================================================

# CORS Allowed Origins
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5000,https://hub.gametribe.com,https://gametribe.com,https://gt-server-mu.vercel.app

# File Upload Limits
MAX_FILE_SIZE=5242880
MAX_FIELD_SIZE=10485760
MAX_PARTS=10

# =============================================================================
# PLATFORM CONFIGURATION (OPTIONAL)
# =============================================================================

# Main Platform URLs
MAIN_PLATFORM_URL=https://gt-server-mu.vercel.app
MAIN_PLATFORM_CLIENT=https://gametribe.com

# Community Platform URLs
COMMUNITY_PLATFORM_URL=https://gametribe-backend.onrender.com
COMMUNITY_PLATFORM_CLIENT=https://hub.gametribe.com

# =============================================================================
# SETUP INSTRUCTIONS
# =============================================================================

# 1. FIREBASE SETUP:
#    - Go to Firebase Console (https://console.firebase.google.com/)
#    - Select your project: gametibe2025
#    - Go to Project Settings > Service Accounts
#    - Generate new private key and download firebase-adminsdk.json
#    - Copy the values from the JSON file to FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL

# 2. STRIPE SETUP:
#    - Go to Stripe Dashboard (https://dashboard.stripe.com/)
#    - Get your API keys from Developers > API Keys
#    - For development: use test keys (sk_test_...)
#    - For production: use live keys (sk_live_...)
#    - Set up webhook endpoint and get webhook secret

# 3. EMAIL SETUP (Gmail):
#    - Enable 2-factor authentication on your Google account
#    - Go to Security > 2-Step Verification > App passwords
#    - Generate an App Password for "Mail"
#    - Use that password in EMAIL_PASSWORD

# 4. CACHING SETUP (Optional):
#    - Caching is now handled by in-memory cache service
#    - No external cache setup required

# 4. SENTRY SETUP (Optional but recommended for production):
#    - Create account at https://sentry.io/
#    - Create new project and get DSN
#    - Add DSN to SENTRY_DSN

# 5. M-PESA SETUP (Optional - Kenya only):
#    - Register with Safaricom M-Pesa API
#    - Get consumer key, secret, shortcode, and passkey
#    - Set up callback URL for payment notifications

# =============================================================================
# SECURITY NOTES
# =============================================================================

# - Never commit this file to version control
# - Use test keys for development, live keys for production
# - Keep Firebase service account key secure
# - Use app-specific passwords for email services
# - Monitor memory usage for in-memory cache
# - Regularly rotate API keys and secrets`;

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function setupEnvironment() {
  console.log("🚀 GameTribe Community Backend Environment Setup");
  console.log("================================================\n");

  // Check if .env already exists
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    const overwrite = await question(
      "⚠️  .env file already exists. Overwrite? (y/N): "
    );
    if (overwrite.toLowerCase() !== "y" && overwrite.toLowerCase() !== "yes") {
      console.log("❌ Setup cancelled.");
      rl.close();
      return;
    }
  }

  console.log("📝 Creating .env file with default configuration...\n");

  try {
    fs.writeFileSync(envPath, envTemplate);
    console.log("✅ .env file created successfully!");
    console.log("\n📋 Next Steps:");
    console.log("1. Edit the .env file with your actual configuration values");
    console.log("2. Set up Firebase service account (firebase-adminsdk.json)");
    console.log("3. Configure Stripe API keys");
    console.log("4. Set up email service (optional)");
    console.log("5. Configure caching (now handled automatically)");
    console.log("\n🔐 Security Reminder:");
    console.log("- Never commit .env file to version control");
    console.log("- Use test keys for development, live keys for production");
    console.log("- Keep all API keys and secrets secure");
  } catch (error) {
    console.error("❌ Error creating .env file:", error.message);
  }

  rl.close();
}

// Run the setup
setupEnvironment().catch(console.error);
