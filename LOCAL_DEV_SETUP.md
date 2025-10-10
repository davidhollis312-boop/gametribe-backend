# Local Development Setup

## Quick Start

### 1. Install Dependencies

```bash
cd gametribe-backend
npm install
```

### 2. Create Environment File

Create a `.env` file in the `gametribe-backend` directory:

```bash
# Copy the example and edit it
cp config/production.env.example .env
```

### 3. Configure Environment Variables

Edit `.env` and set the following **REQUIRED** variables:

```bash
NODE_ENV=development
PORT=5000

# Frontend URL - REQUIRED for payment redirects
FRONTEND_URL=http://localhost:5173

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Firebase (get from Firebase Console)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# JWT
JWT_SECRET=your-local-jwt-secret-for-testing

# Challenge System
CHALLENGE_ENCRYPTION_KEY=your-32-character-local-key-test!
HASH_SALT=your-local-hash-salt
REQUEST_SIGNATURE_SECRET=your-local-signature-secret
```

### 4. Optional: Configure Payment Providers

#### Stripe (for card payments)

```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

#### M-Pesa (for mobile money payments)

```bash
MPESA_CONSUMER_KEY=your_mpesa_sandbox_consumer_key
MPESA_CONSUMER_SECRET=your_mpesa_sandbox_consumer_secret
MPESA_SHORTCODE=174379
MPESA_PASSKEY=your_mpesa_sandbox_passkey
MPESA_CALLBACK_URL=http://localhost:5000/api/payments/mpesa/webhook
MPESA_ENVIRONMENT=sandbox
```

> **Note**: For local M-Pesa testing, you'll need to expose your localhost using ngrok or similar:
>
> ```bash
> ngrok http 5000
> # Then use the ngrok URL for MPESA_CALLBACK_URL
> ```

### 5. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:5000`

### 6. Verify It's Working

Test the health endpoint:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-10-08T..."
}
```

## Frontend Setup

Make sure your frontend is configured to use the local backend:

**File**: `frontend/.env`

```bash
VITE_API_URL=http://localhost:5000
VITE_BACKEND_URL=http://localhost:5000
```

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`

## Testing Payment Redirects Locally

### Stripe

1. Use Stripe test card: `4242 4242 4242 4242`
2. Any future expiry date, any CVC
3. After payment, should redirect to:
   ```
   http://localhost:5173/profile?tab=wallet&payment=success&session_id=...
   ```

### M-Pesa (requires ngrok)

1. Install ngrok: `npm install -g ngrok`
2. Start ngrok: `ngrok http 5000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Update `.env`:
   ```bash
   MPESA_CALLBACK_URL=https://abc123.ngrok.io/api/payments/mpesa/webhook
   ```
5. Restart the server
6. Test M-Pesa payment with Safaricom test numbers

## Common Issues

### Issue: "Cannot find module 'firebase-admin'"

**Fix**: Run `npm install`

### Issue: "Firebase not configured"

**Fix**: Set `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_DATABASE_URL`, and `FIREBASE_STORAGE_BUCKET` in `.env`

### Issue: CORS errors from frontend

**Fix**:

1. Ensure `ALLOWED_ORIGINS` includes `http://localhost:5173`
2. Restart the backend server

### Issue: Payment redirects not working

**Fix**:

1. Ensure `FRONTEND_URL=http://localhost:5173` in backend `.env`
2. Restart the backend

### Issue: M-Pesa callback not received

**Fix**:

1. Use ngrok to expose localhost
2. Update `MPESA_CALLBACK_URL` with ngrok URL
3. Restart server

## Project Structure

```
gametribe-backend/
├── config/              # Configuration files
├── controllers/         # Business logic
├── middleware/          # Express middleware
├── models/              # Data models
├── routes/              # API routes
├── services/            # External services
├── utils/               # Utility functions
├── index.js             # Server entry point
├── package.json         # Dependencies
└── .env                 # Environment variables (create this)
```

## Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server (with nodemon)
- `npm test` - Run tests (if available)

## Environment Variables Reference

See `config/production.env.example` for a complete list of available environment variables.

## Debugging

Enable detailed logging by setting:

```bash
NODE_ENV=development
```

Check server logs in the terminal for detailed information about:

- API requests
- Database operations
- Payment processing
- Error messages

## Next Steps

Once local development is working:

1. Review `VERCEL_DEPLOYMENT.md` for production deployment
2. Test all features locally before deploying
3. Set up proper production environment variables in Vercel
