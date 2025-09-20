# Environment Setup Guide for GameTribe Community Backend

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
cd gametribe-backend
node setup-env.js
```

### Option 2: Manual Setup

```bash
cd gametribe-backend
cp config/production.env.example .env
# Edit .env with your actual values
```

## 📋 Required Environment Variables

### 🔥 Critical (Must Configure)

| Variable                | Description                          | Example                                                      |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------ |
| `NODE_ENV`              | Environment mode                     | `development` or `production`                                |
| `PORT`                  | Server port                          | `5000`                                                       |
| `FIREBASE_PROJECT_ID`   | Firebase project ID                  | `gametibe2025`                                               |
| `FIREBASE_PRIVATE_KEY`  | Firebase service account private key | `"-----BEGIN PRIVATE KEY-----\n..."`                         |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email       | `firebase-adminsdk-xxx@gametibe2025.iam.gserviceaccount.com` |
| `STRIPE_SECRET_KEY`     | Stripe API secret key                | `sk_test_...` or `sk_live_...`                               |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret                | `whsec_...`                                                  |

### 💳 Payment Integration

| Variable                | Description                 | Required        |
| ----------------------- | --------------------------- | --------------- |
| `MPESA_CONSUMER_KEY`    | M-Pesa consumer key         | No (Kenya only) |
| `MPESA_CONSUMER_SECRET` | M-Pesa consumer secret      | No (Kenya only) |
| `MPESA_SHORTCODE`       | M-Pesa shortcode (6 digits) | No (Kenya only) |
| `MPESA_PASSKEY`         | M-Pesa passkey              | No (Kenya only) |
| `MPESA_CALLBACK_URL`    | M-Pesa callback URL         | No (Kenya only) |

### 📧 Email Service

| Variable         | Description                 | Required |
| ---------------- | --------------------------- | -------- |
| `EMAIL_SERVICE`  | Email service provider      | No       |
| `EMAIL_USER`     | Email address               | No       |
| `EMAIL_PASSWORD` | Email password/app password | No       |

### 🚀 Performance & Caching

| Variable                                                  | Description                              | Required |
| --------------------------------------------------------- | ---------------------------------------- | -------- |
| _Note: Caching is now handled by in-memory cache service_ | _No external cache configuration needed_ | _No_     |

### 📊 Monitoring & Analytics

| Variable                 | Description                  | Required |
| ------------------------ | ---------------------------- | -------- |
| `SENTRY_DSN`             | Sentry error tracking DSN    | No       |
| `AI_MODERATION_ENABLED`  | Enable AI content moderation | No       |
| `AI_MODERATION_ENDPOINT` | AI moderation service URL    | No       |
| `AI_MODERATION_API_KEY`  | AI moderation API key        | No       |

### 🗄️ Storage Configuration

| Variable                      | Description                 | Required |
| ----------------------------- | --------------------------- | -------- |
| `FIREBASE_STORAGE_BUCKET`     | Firebase storage bucket     | No       |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | Google Cloud storage bucket | No       |
| `FALLBACK_STORAGE_URL`        | Fallback storage URL        | No       |

### 🔒 Security & CORS

| Variable          | Description              | Required |
| ----------------- | ------------------------ | -------- |
| `ALLOWED_ORIGINS` | CORS allowed origins     | No       |
| `MAX_FILE_SIZE`   | Maximum file upload size | No       |
| `MAX_FIELD_SIZE`  | Maximum field size       | No       |
| `MAX_PARTS`       | Maximum form parts       | No       |

## 🔧 Setup Instructions

### 1. Firebase Configuration

#### Get Firebase Service Account Key:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `gametibe2025`
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate new private key**
5. Download the `firebase-adminsdk.json` file
6. Copy the values to your `.env` file:
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
   ```

#### Enable Firebase Storage:

1. In Firebase Console, go to **Storage**
2. Click **Get started**
3. Choose **Start in test mode** (for development)
4. Select your preferred location
5. The bucket should be: `gametibe2025.appspot.com`

### 2. Stripe Configuration

#### Get Stripe API Keys:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Developers** > **API Keys**
3. Copy your keys:

   ```bash
   # For development
   STRIPE_SECRET_KEY=sk_test_...

   # For production
   STRIPE_SECRET_KEY=sk_live_...
   ```

#### Set up Webhooks:

1. Go to **Developers** > **Webhooks**
2. Click **Add endpoint**
3. Set URL: `https://your-domain.com/api/payments/stripe/webhook`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
5. Copy the webhook secret:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 3. Email Service Setup (Gmail)

#### Enable App Passwords:

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Enable **2-factor authentication** if not already enabled
3. Go to **Security** > **2-Step Verification** > **App passwords**
4. Generate an App Password for "Mail"
5. Use that password in your `.env`:
   ```bash
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your_16_character_app_password
   ```

### 4. Caching Setup (Optional)

#### Note:

Caching is now handled automatically by the in-memory cache service. No external cache setup is required.

### 4. Sentry Setup (Optional but Recommended)

#### Create Sentry Project:

1. Go to [Sentry.io](https://sentry.io/)
2. Create a new project
3. Select **Node.js** as platform
4. Copy the DSN:
   ```bash
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```

### 5. M-Pesa Setup (Kenya Only)

#### Register with Safaricom:

1. Go to [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Register and create an app
3. Get your credentials:
   ```bash
   MPESA_CONSUMER_KEY=your_consumer_key
   MPESA_CONSUMER_SECRET=your_consumer_secret
   MPESA_SHORTCODE=123456
   MPESA_PASSKEY=your_passkey
   MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
   ```

## 🧪 Testing Your Configuration

### Test Firebase Connection:

```bash
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://gametibe2025-default-rtdb.firebaseio.com'
});
console.log('✅ Firebase connection successful');
"
```

### Test Stripe Connection:

```bash
node -e "
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
stripe.balance.retrieve().then(console.log).catch(console.error);
"
```

### Test Cache Service:

```bash
node -e "
const cacheService = require('./services/cache');
cacheService.healthCheck().then(result => {
  console.log('✅ Cache service health check:', result);
}).catch(console.error);
"
```

## 🚀 Environment-Specific Configurations

### Development Environment

```bash
NODE_ENV=development
STRIPE_SECRET_KEY=sk_test_...
SENTRY_DSN=  # Leave empty for development
AI_MODERATION_ENABLED=false
```

### Production Environment

```bash
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_...
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
AI_MODERATION_ENABLED=true
# Caching handled automatically
```

### Staging Environment

```bash
NODE_ENV=production
STRIPE_SECRET_KEY=sk_test_...  # Use test keys for staging
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
AI_MODERATION_ENABLED=false
```

## 🔐 Security Best Practices

### Environment File Security:

- ✅ Never commit `.env` files to version control
- ✅ Use `.env.example` for templates
- ✅ Add `.env` to `.gitignore`
- ✅ Use different keys for different environments

### API Key Security:

- ✅ Use test keys for development
- ✅ Use live keys only for production
- ✅ Rotate keys regularly
- ✅ Use app-specific passwords for email services

### Firebase Security:

- ✅ Keep service account keys secure
- ✅ Use Firebase Security Rules
- ✅ Enable Firebase App Check
- ✅ Monitor Firebase usage

### Stripe Security:

- ✅ Use webhook signatures to verify requests
- ✅ Never expose secret keys in client-side code
- ✅ Use Stripe's test mode for development
- ✅ Monitor Stripe dashboard for suspicious activity

## 🆘 Troubleshooting

### Common Issues:

#### Firebase Connection Failed:

```
Error: Firebase Admin SDK initialization failed
```

**Solution:**

- Check if `firebase-adminsdk.json` exists
- Verify `FIREBASE_PROJECT_ID` matches your project
- Ensure service account has proper permissions

#### Stripe Webhook Failed:

```
Error: Invalid webhook signature
```

**Solution:**

- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Check webhook endpoint URL
- Ensure webhook events are properly configured

#### Cache Service Issues:

```
Error: Cache service not responding
```

**Solution:**

- Check application logs for cache service errors
- Verify memory usage is within limits
- Restart the application if needed

#### Email Service Failed:

```
Error: Invalid login credentials
```

**Solution:**

- Use app-specific password for Gmail
- Enable 2-factor authentication
- Check email service configuration

### Debug Commands:

```bash
# Check environment variables
node -e "console.log(process.env)"

# Test specific service
node -e "require('./config/firebase')"
node -e "require('./services/cache')"

# Check file permissions
ls -la .env
ls -la firebase-adminsdk.json
```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all required environment variables are set
3. Test individual services using the debug commands
4. Check service-specific documentation:
   - [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
   - [Stripe API](https://stripe.com/docs/api)
   - [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
   - [Sentry Node.js](https://docs.sentry.io/platforms/node/)

## 📝 Environment File Template

Create your `.env` file with this template:

```bash
# Copy this to .env and fill in your values

# Core Configuration
NODE_ENV=development
PORT=5000

# Firebase (Required)
FIREBASE_PROJECT_ID=gametibe2025
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@gametibe2025.iam.gserviceaccount.com

# Stripe (Required)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_secret_here

# Email (Optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password

# Caching (Handled automatically)
# No configuration needed

# Sentry (Optional)
SENTRY_DSN=https://your-dsn@sentry.io/project-id

# M-Pesa (Optional - Kenya only)
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=123456
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
```

Remember to replace all placeholder values with your actual configuration!
