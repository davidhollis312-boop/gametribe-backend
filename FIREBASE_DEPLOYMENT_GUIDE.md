# Firebase Deployment Guide

## 🚀 Quick Deployment (5 Steps)

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase

```bash
firebase login
```

### Step 3: Initialize Your Project

```bash
cd gametribe-backend

# Link to your Firebase project
firebase use --add

# Select your project from the list
# Enter alias: production (or default)
```

This will update `.firebaserc` with your actual project ID.

### Step 4: Set Environment Variables

```bash
# Generate encryption keys first
node -e "console.log('CHALLENGE_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MOBILE_APP_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Set environment variables in Firebase
firebase functions:config:set \
  encryption.challenge_key="your-generated-encryption-key-here" \
  mobile.app_secret="your-generated-mobile-secret-here" \
  stripe.secret_key="sk_live_your_stripe_key" \
  stripe.webhook_secret="whsec_your_webhook_secret" \
  mpesa.consumer_key="your_mpesa_key" \
  mpesa.consumer_secret="your_mpesa_secret" \
  mpesa.shortcode="your_shortcode" \
  mpesa.passkey="your_passkey" \
  email.user="your-email@gmail.com" \
  email.pass="your-app-password" \
  cors.allowed_origins="https://your-frontend.com,https://admin.your-site.com" \
  node.env="production"

# View configured variables
firebase functions:config:get
```

**Alternative: Using .env file with Functions (Newer method)**

Create `.env` file in `gametribe-backend/`:

```env
CHALLENGE_ENCRYPTION_KEY=your-key
MOBILE_APP_SECRET=your-secret
STRIPE_SECRET_KEY=sk_live_xxx
# ... other vars
```

Then Firebase will automatically load this `.env` file.

### Step 5: Install Dependencies & Deploy

```bash
# Install firebase-functions package
npm install

# Deploy functions and database rules
firebase deploy

# Or deploy only functions
firebase deploy --only functions

# Or deploy only database rules
firebase deploy --only database
```

---

## 📋 Detailed Deployment Steps

### 1. Check Firebase Configuration

Verify your `firebase.json`:

```json
{
  "functions": {
    "source": ".",
    "runtime": "nodejs20",
    "ignore": ["node_modules", ".git", "firebase-debug.log"]
  },
  "database": {
    "rules": "firebase-security-rules.json"
  }
}
```

### 2. Verify Project Structure

Your backend should have:

- ✅ `firebase.json` (created)
- ✅ `.firebaserc` (will be created/updated)
- ✅ `package.json` with `firebase-functions` dependency
- ✅ `index.js` exporting `exports.api`
- ✅ `firebase-security-rules.json` (database rules)

### 3. Test Locally (Optional)

```bash
# Start Firebase emulators
npm run serve

# OR
firebase emulators:start --only functions

# Test your endpoints at:
# http://localhost:5001/YOUR-PROJECT-ID/us-central1/api
```

### 4. Deploy to Production

```bash
# Full deployment
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only database rules
firebase deploy --only database

# Deploy with force (if having issues)
firebase deploy --only functions --force
```

### 5. Get Your Function URL

After deployment, Firebase will output your function URL:

```
✔ functions[api(us-central1)] https://us-central1-your-project.cloudfunctions.net/api
```

Your API will be available at:

```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
```

All your routes will work:

- `https://...cloudfunctions.net/api/posts`
- `https://...cloudfunctions.net/api/challenges/create`
- `https://...cloudfunctions.net/api/wallet/balance`
- etc.

---

## 🔧 Environment Variables Setup

### Method 1: Firebase CLI (Recommended for Production)

```bash
# Set individual variables
firebase functions:config:set key.name="value"

# Set multiple at once
firebase functions:config:set \
  encryption.challenge_key="xxx" \
  mobile.app_secret="yyy"

# Get current config
firebase functions:config:get

# Delete a variable
firebase functions:config:unset key.name
```

**Access in code**:

```javascript
const functions = require("firebase-functions");
const encryptionKey = functions.config().encryption.challenge_key;
```

### Method 2: .env File (Easier for Development)

Create `.env` in `gametribe-backend/`:

```env
CHALLENGE_ENCRYPTION_KEY=your-key
MOBILE_APP_SECRET=your-secret
NODE_ENV=production
```

Firebase automatically loads `.env` files in Functions.

### Method 3: Environment Variables UI

1. Go to Firebase Console
2. Navigate to Functions
3. Click on your function
4. Go to "Configuration" tab
5. Add environment variables

---

## 🔒 Security Checklist

Before deploying:

- [ ] Generate strong `CHALLENGE_ENCRYPTION_KEY` (32+ characters)
- [ ] Generate strong `MOBILE_APP_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Update `ALLOWED_ORIGINS` with your frontend URLs
- [ ] Set production Stripe keys (not test keys)
- [ ] Set production M-Pesa credentials
- [ ] Deploy database security rules
- [ ] Test all endpoints after deployment
- [ ] Verify authentication works
- [ ] Test challenge creation with real wallet

---

## 📊 Monitoring & Logs

### View Logs

```bash
# Stream logs in real-time
firebase functions:log

# OR in Firebase Console
# Go to Functions → Select function → Logs tab
```

### Monitor Performance

```bash
# View function metrics
firebase functions:list

# OR in Firebase Console
# Functions → Dashboard → View metrics
```

### Common Log Commands

```bash
# View last 100 logs
firebase functions:log --limit 100

# View logs from last hour
firebase functions:log --since 1h

# View only errors
firebase functions:log --only=error
```

---

## 🐛 Troubleshooting

### Issue: "Function deployment failed"

**Solution**: Check your `package.json` has `firebase-functions`:

```bash
npm install firebase-functions --save
```

### Issue: "ENCRYPTION_KEY not set" error

**Solution**: Set environment variables:

```bash
firebase functions:config:set encryption.challenge_key="your-key"
firebase deploy --only functions
```

Or add to `.env` file.

### Issue: "Permission denied" on database

**Solution**: Deploy security rules:

```bash
firebase deploy --only database
```

### Issue: Function times out

**Solution**: Increase timeout in `firebase.json`:

```json
{
  "functions": {
    "source": ".",
    "runtime": "nodejs20",
    "timeout": "60s"
  }
}
```

### Issue: Cold start is slow

**Solutions**:

1. Use minimum instances (costs money):

```javascript
exports.api = functions.runWith({ minInstances: 1 }).https.onRequest(app);
```

2. Or upgrade to 2nd gen functions (faster, cheaper):

```javascript
const { onRequest } = require("firebase-functions/v2/https");
exports.api = onRequest(app);
```

---

## 💰 Pricing Considerations

**Firebase Functions Pricing**:

- Free tier: 125K invocations/month, 40K GB-seconds/month
- After free tier: $0.40 per million invocations
- Networking: $0.12 per GB

**Cost Optimization**:

1. Use function bundling (all routes in one function)
2. Cache responses where possible
3. Optimize cold starts
4. Consider Cloud Run for high traffic

---

## 🔄 Update Deployment

### Update Code

```bash
# Make changes to your code
git add .
git commit -m "Update: added new feature"

# Deploy updates
firebase deploy --only functions
```

### Update Environment Variables

```bash
# Update a variable
firebase functions:config:set key.name="new-value"

# Deploy to apply changes
firebase deploy --only functions
```

### Update Database Rules

```bash
# Edit firebase-security-rules.json
# Then deploy
firebase deploy --only database
```

---

## 🌍 Multi-Region Deployment (Optional)

Deploy to multiple regions for better performance:

```javascript
// In index.js
const functions = require("firebase-functions");

exports.api_us = functions.region("us-central1").https.onRequest(app);

exports.api_eu = functions.region("europe-west1").https.onRequest(app);

exports.api_asia = functions.region("asia-east1").https.onRequest(app);
```

---

## 📱 Update Frontend/PlayChat

After deployment, update API URLs:

### Frontend (.env):

```env
VITE_API_ENDPOINT=https://us-central1-YOUR-PROJECT.cloudfunctions.net/api
```

### PlayChat (lib/services/betting_challenge_service.dart):

```dart
static const String productionBackendUrl =
    'https://us-central1-YOUR-PROJECT.cloudfunctions.net/api/challenges';
```

---

## ✅ Post-Deployment Checklist

- [ ] Function deployed successfully
- [ ] Database rules deployed
- [ ] Environment variables set
- [ ] Function URL obtained
- [ ] Frontend/PlayChat updated with new URL
- [ ] Test authentication works
- [ ] Test challenge creation
- [ ] Test wallet operations
- [ ] Test all critical endpoints
- [ ] Monitor logs for errors
- [ ] Check function metrics

---

## 📞 Support

If you encounter issues:

1. Check logs: `firebase functions:log`
2. Check Firebase Console → Functions → Logs
3. Verify environment variables: `firebase functions:config:get`
4. Test locally: `firebase emulators:start --only functions`
5. Check deployment status: `firebase functions:list`

---

## 🎉 Success!

Once deployed, your backend will be:

- ✅ Serverless (auto-scaling)
- ✅ Highly available
- ✅ Globally distributed
- ✅ Secure (with security fixes implemented)
- ✅ Monitored (Firebase Console)

**Your Function URL**:

```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
```

Use this URL in your frontend and PlayChat apps!

---

**Last Updated**: October 21, 2025  
**Guide Version**: 1.0

