# Deployment Changes Summary

## Changes Made

### 1. Removed Cloud Run Files ✅

Deleted the following Cloud Run-specific files:

- `Dockerfile`
- `app.yaml`
- `cloudbuild.yaml`
- `deploy.ps1`
- `set-env-vars.ps1`
- `DEPLOYMENT_GUIDE.md`
- `QUICK_START.md`
- `README_CLOUD_DEPLOYMENT.md`

### 2. Reverted Server Configuration for Vercel ✅

**File**: `index.js`

- Changed port from `8080` to `5000`
- Removed `0.0.0.0` binding (not needed for Vercel)
- Updated comments to reference Vercel instead of Cloud Run

### 3. Created Vercel Configuration ✅

**File**: `vercel.json`

- Created standard Vercel configuration
- Routes all requests to `index.js`
- Sets `NODE_ENV=production`

### 4. Updated Environment Configuration ✅

**File**: `config/production.env.example`

- Added `FRONTEND_URL` variable (REQUIRED for payment redirects)
- Updated M-Pesa callback URL to use Vercel pattern
- Added `MPESA_ENVIRONMENT` variable

### 5. Created Deployment Documentation ✅

**File**: `VERCEL_DEPLOYMENT.md`

- Comprehensive Vercel deployment guide
- Environment variables checklist
- Troubleshooting section
- Post-deployment steps

## Payment Redirect Fix

### The Problem

Payment redirects were hardcoded to `http://localhost:5173`, causing production payments to redirect to localhost.

### The Solution

The backend already uses `process.env.FRONTEND_URL` for redirects:

```javascript
success_url: `${
  process.env.FRONTEND_URL || "http://localhost:5173"
}/profile?tab=wallet&payment=success&session_id={CHECKOUT_SESSION_ID}`;
```

**You just need to set the `FRONTEND_URL` environment variable in Vercel.**

## M-Pesa Configuration

### The Problem

M-Pesa token generation was failing because environment variables were not set in the deployment.

### The Solution

M-Pesa requires these environment variables:

1. `MPESA_CONSUMER_KEY`
2. `MPESA_CONSUMER_SECRET`
3. `MPESA_SHORTCODE` (must be 6 digits)
4. `MPESA_PASSKEY`
5. `MPESA_CALLBACK_URL` (must be HTTPS)
6. `MPESA_ENVIRONMENT` (sandbox or production)

**All must be set in Vercel for M-Pesa to work.**

## Next Steps

### 1. Deploy to Vercel

#### Option A: Via Dashboard

1. Go to [vercel.com](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your repository
4. Select `gametribe-backend` as root directory
5. Configure environment variables (see below)
6. Click "Deploy"

#### Option B: Via CLI

```bash
cd gametribe-backend
vercel
```

### 2. Set Environment Variables in Vercel

Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

#### **Critical Variables** (MUST SET):

```bash
# Frontend URL - REQUIRED for payment redirects
FRONTEND_URL=https://your-frontend-domain.com

# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# CORS
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173

# JWT
JWT_SECRET=your-super-secret-jwt-key-here

# Challenge System
CHALLENGE_ENCRYPTION_KEY=your-32-character-secret-key-here!
HASH_SALT=your-hash-salt-here
REQUEST_SIGNATURE_SECRET=your-request-signature-secret
```

#### **Payment Variables** (if using payments):

**Stripe**:

```bash
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

**M-Pesa**:

```bash
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_SHORTCODE=123456
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://your-backend.vercel.app/api/payments/mpesa/webhook
MPESA_ENVIRONMENT=sandbox
```

### 3. Update M-Pesa Callback URL

After deployment, you'll get a Vercel URL like:

```
https://gametribe-backend-xxxxx.vercel.app
```

1. Update `MPESA_CALLBACK_URL` in Vercel environment variables:
   ```
   https://gametribe-backend-xxxxx.vercel.app/api/payments/mpesa/webhook
   ```
2. Also update this URL in your M-Pesa Daraja dashboard
3. Redeploy the backend

### 4. Update Frontend Environment Variables

**File**: `frontend/.env`

```bash
VITE_API_URL=https://your-backend-vercel-url.vercel.app
VITE_BACKEND_URL=https://your-backend-vercel-url.vercel.app
```

### 5. Update Stripe Webhooks (if using Stripe)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-backend-vercel-url.vercel.app/api/payments/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the signing secret
5. Update `STRIPE_WEBHOOK_SECRET` in Vercel

### 6. Test Payment Flow

1. **Local Testing**:

   ```bash
   cd gametribe-backend
   npm install
   npm start
   ```

   - Ensure `.env` has `FRONTEND_URL=http://localhost:5173`

2. **Production Testing**:
   - Make a test payment
   - Verify redirect goes to your frontend (not localhost)
   - Check Vercel logs for any errors

## Verification Checklist

After deployment, verify:

- [ ] Backend is accessible: `https://your-backend.vercel.app/health`
- [ ] Frontend can make API calls
- [ ] No CORS errors in browser console
- [ ] Stripe payments redirect to frontend (not localhost)
- [ ] M-Pesa payments work (if configured)
- [ ] Stripe webhooks are received
- [ ] Check Vercel logs for errors

## Troubleshooting

### Payment Redirects to Localhost

**Fix**: Set `FRONTEND_URL` environment variable in Vercel

### M-Pesa Token Generation Fails

**Check**:

1. All M-Pesa env vars are set
2. `MPESA_SHORTCODE` is exactly 6 digits
3. `MPESA_CALLBACK_URL` uses HTTPS
4. Credentials are valid

### CORS Errors

**Fix**: Update `ALLOWED_ORIGINS` to include your frontend domain

### Stripe Webhook Failures

**Fix**: Update webhook URL in Stripe Dashboard to your Vercel backend URL

## Support

For detailed instructions, see:

- **Vercel Deployment**: `VERCEL_DEPLOYMENT.md`
- **Environment Variables**: `config/production.env.example`

For issues:

- Check Vercel deployment logs
- Check function logs in Vercel dashboard
- Test endpoints manually
