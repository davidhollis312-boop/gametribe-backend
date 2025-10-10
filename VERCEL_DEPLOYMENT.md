# Vercel Deployment Guide for GameTribe Backend

This guide explains how to deploy the GameTribe backend to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI** (optional): `npm install -g vercel`
3. **Environment Variables**: Have all required credentials ready

## Quick Deployment via Vercel Dashboard

### 1. Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. Import your repository
4. Select the **`gametribe-backend`** folder as the root directory

### 2. Configure Build Settings

- **Framework Preset**: Other
- **Build Command**: Leave empty (not needed for Node.js)
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

### 3. Set Environment Variables

Click **"Environment Variables"** and add the following:

#### **Required for All Deployments**

```bash
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
```

> ⚠️ **IMPORTANT**: Replace `https://your-frontend-domain.com` with your actual frontend URL.
> This is REQUIRED for payment redirects to work correctly.

#### **Firebase Configuration**

```bash
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
```

#### **CORS Configuration**

```bash
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173
```

#### **Stripe Configuration** (if using Stripe)

```bash
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

#### **M-Pesa Configuration** (if using M-Pesa)

```bash
MPESA_CONSUMER_KEY=your_mpesa_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_consumer_secret
MPESA_SHORTCODE=123456
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://your-backend-domain.vercel.app/api/payments/mpesa/webhook
MPESA_ENVIRONMENT=sandbox
```

> ⚠️ **Note**: After deployment, update `MPESA_CALLBACK_URL` with your actual Vercel backend URL.

#### **Challenge System Configuration**

```bash
CHALLENGE_ENCRYPTION_KEY=your-32-character-secret-key-here!
HASH_SALT=your-hash-salt-here
REQUEST_SIGNATURE_SECRET=your-request-signature-secret
```

#### **JWT Configuration**

```bash
JWT_SECRET=your-super-secret-jwt-key-here
```

### 4. Deploy

Click **"Deploy"** and wait for the build to complete.

## Quick Deployment via CLI

```bash
cd gametribe-backend
vercel
```

Follow the prompts and configure environment variables via the dashboard.

## Post-Deployment Steps

### 1. Update M-Pesa Callback URL

After deployment, you'll get a URL like `https://gametribe-backend-xxxxx.vercel.app`

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `MPESA_CALLBACK_URL` to:
   ```
   https://your-actual-vercel-url.vercel.app/api/payments/mpesa/webhook
   ```
3. Redeploy to apply changes

### 2. Update Frontend Environment Variables

Update your frontend `.env` file with the new backend URL:

```bash
VITE_API_URL=https://your-backend-vercel-url.vercel.app
VITE_BACKEND_URL=https://your-backend-vercel-url.vercel.app
```

### 3. Update CORS Origins

Make sure your backend `ALLOWED_ORIGINS` includes your frontend URL.

### 4. Test Payment Redirects

1. Make a test Stripe payment
2. After payment, you should be redirected to:
   ```
   https://your-frontend-domain.com/profile?tab=wallet&payment=success&session_id=...
   ```
3. Verify the redirect goes to your actual frontend, not localhost

## Testing Locally with Vercel Environment

To test locally with Vercel environment variables:

```bash
cd gametribe-backend
vercel env pull .env.local
vercel dev
```

This will:

1. Pull environment variables from Vercel
2. Start a local development server with Vercel's runtime

## Troubleshooting

### Issue: Payment redirects to localhost instead of production frontend

**Solution**: Set the `FRONTEND_URL` environment variable in Vercel:

```bash
FRONTEND_URL=https://your-actual-frontend-domain.com
```

### Issue: M-Pesa "Failed to generate M-Pesa token"

**Solutions**:

1. Verify all M-Pesa environment variables are set correctly
2. Check that `MPESA_CONSUMER_KEY` and `MPESA_CONSUMER_SECRET` are valid
3. Ensure `MPESA_SHORTCODE` is exactly 6 digits
4. Verify `MPESA_CALLBACK_URL` is HTTPS and points to your Vercel deployment

### Issue: CORS errors from frontend

**Solution**: Update `ALLOWED_ORIGINS` to include your frontend domain:

```bash
ALLOWED_ORIGINS=https://your-frontend-domain.com,http://localhost:5173
```

### Issue: Stripe webhook failures

**Solution**:

1. Go to Stripe Dashboard → Webhooks
2. Update the endpoint URL to your Vercel backend:
   ```
   https://your-backend-vercel-url.vercel.app/api/payments/webhook
   ```
3. Update `STRIPE_WEBHOOK_SECRET` with the new webhook signing secret

## Environment Variables Checklist

Before deploying, ensure you have:

- [ ] `FRONTEND_URL` - Your frontend domain (REQUIRED for payments)
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` - Firebase admin credentials
- [ ] `FIREBASE_DATABASE_URL` - Firebase Realtime Database URL
- [ ] `FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket
- [ ] `ALLOWED_ORIGINS` - CORS allowed origins
- [ ] `STRIPE_SECRET_KEY` - Stripe API key (if using Stripe)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (if using Stripe)
- [ ] `MPESA_CONSUMER_KEY` - M-Pesa consumer key (if using M-Pesa)
- [ ] `MPESA_CONSUMER_SECRET` - M-Pesa consumer secret (if using M-Pesa)
- [ ] `MPESA_SHORTCODE` - M-Pesa shortcode (if using M-Pesa)
- [ ] `MPESA_PASSKEY` - M-Pesa passkey (if using M-Pesa)
- [ ] `MPESA_CALLBACK_URL` - M-Pesa callback URL (if using M-Pesa)
- [ ] `CHALLENGE_ENCRYPTION_KEY` - Challenge system encryption key
- [ ] `JWT_SECRET` - JWT signing secret

## Vercel-Specific Considerations

### Function Timeout

- **Free Plan**: 10 seconds
- **Pro Plan**: 60 seconds
- M-Pesa STK push may require Pro plan due to longer processing times

### Function Size

- Maximum: 50 MB
- Keep dependencies minimal

### Cold Starts

- First request after inactivity may be slow
- Consider using Vercel's Edge Functions for better performance

## Support

For issues:

1. Check Vercel deployment logs: Dashboard → Your Project → Deployments → Latest → Logs
2. Check function logs: Dashboard → Your Project → Logs
3. Test endpoints: `https://your-backend.vercel.app/health`

## Security Notes

1. **Never commit** `.env` files to version control
2. **Use Vercel's environment variables** for all secrets
3. **Rotate secrets regularly**, especially `JWT_SECRET` and encryption keys
4. **Use HTTPS** for all callback URLs (required by Stripe and M-Pesa)
5. **Whitelist domains** in `ALLOWED_ORIGINS` - don't use wildcards in production
