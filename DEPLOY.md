# 🚀 Quick Deploy to Firebase

## One-Time Setup (5 minutes)

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login

```bash
firebase login
```

### 3. Link Your Project

```bash
cd gametribe-backend
firebase use --add
# Select your project from the list
```

### 4. Generate & Set Keys

```bash
# Generate keys
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('MOBILE_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Set in Firebase (replace with your generated keys)
firebase functions:config:set \
  encryption.challenge_key="YOUR_ENCRYPTION_KEY_HERE" \
  mobile.app_secret="YOUR_MOBILE_SECRET_HERE" \
  node.env="production"
```

### 5. Deploy

```bash
firebase deploy
```

**That's it!** 🎉

---

## Your Function URL

After deployment, you'll see:

```
https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
```

Update this URL in:

- Frontend `.env`: `VITE_API_ENDPOINT=...`
- PlayChat services: `productionBackendUrl=...`

---

## Common Commands

```bash
# Deploy everything
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only database rules
firebase deploy --only database

# View logs
firebase functions:log

# Test locally
firebase emulators:start --only functions
```

---

## Environment Variables

You can also use a `.env` file (easier):

Create `.env` in `gametribe-backend/`:

```env
CHALLENGE_ENCRYPTION_KEY=your-key
MOBILE_APP_SECRET=your-secret
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_xxx
ALLOWED_ORIGINS=https://your-frontend.com
```

Then just deploy:

```bash
firebase deploy --only functions
```

---

## Troubleshooting

**Error: "ENCRYPTION_KEY not set"**

```bash
firebase functions:config:set encryption.challenge_key="your-key"
firebase deploy --only functions
```

**View current config**

```bash
firebase functions:config:get
```

**Check logs**

```bash
firebase functions:log
```

---

For detailed guide, see `FIREBASE_DEPLOYMENT_GUIDE.md`

