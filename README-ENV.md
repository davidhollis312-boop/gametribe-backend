# Environment Setup - Quick Start

## 🚀 Quick Setup

The `.env` file has been created successfully! Now you need to configure it with your actual values.

## 📋 Required Configuration

### 1. Firebase Setup (Required)
- Download `firebase-adminsdk.json` from Firebase Console
- Update these values in `.env`:
  ```bash
  FIREBASE_PROJECT_ID=gametibe2025
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@gametibe2025.iam.gserviceaccount.com
  ```

### 2. Stripe Setup (Required)
- Get API keys from [Stripe Dashboard](https://dashboard.stripe.com/)
- Update these values in `.env`:
  ```bash
  STRIPE_SECRET_KEY=sk_test_your_key_here
  STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
  ```

### 3. Optional Services
- **Email**: Configure Gmail or other email service
- **Redis**: Set up for caching (optional)
- **Sentry**: Set up for error tracking (optional)
- **M-Pesa**: Set up for Kenya mobile payments (optional)

## 📖 Detailed Instructions

See `ENVIRONMENT_SETUP.md` for complete setup instructions.

## 🧪 Test Your Setup

```bash
# Test Firebase connection
node -e "require('./config/firebase'); console.log('✅ Firebase OK');"

# Test Stripe connection
node -e "const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); stripe.balance.retrieve().then(() => console.log('✅ Stripe OK')).catch(console.error);"
```

## 🔐 Security Reminder

- Never commit `.env` file to version control
- Use test keys for development, live keys for production
- Keep all API keys secure
