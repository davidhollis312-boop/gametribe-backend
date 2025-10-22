# ⚡ Quick Start - Deploy & Test in 5 Minutes

## 🎯 Prerequisites

- Node.js installed
- Firebase account with project ID: `gametibe2025`

---

## 🚀 Deploy (5 Commands)

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Navigate to backend
cd gametribe-backend

# 4. Generate keys and create .env file
node -e "console.log('CHALLENGE_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))" > .env
node -e "console.log('MOBILE_APP_SECRET=' + require('crypto').randomBytes(32).toString('hex'))" >> .env
echo "NODE_ENV=production" >> .env

# 5. Deploy
npm install && firebase deploy
```

---

## 🧪 Test (2 Commands)

```bash
# Test basic endpoint
curl https://us-central1-gametibe2025.cloudfunctions.net/api/test

# Test Firebase connection
curl https://us-central1-gametibe2025.cloudfunctions.net/api/test-firebase
```

**Expected:** Both return JSON with success messages

---

## ✅ Done!

Your backend is live at:

```
https://us-central1-gametibe2025.cloudfunctions.net/api
```

Update this URL in:

- Frontend `.env`: `VITE_API_ENDPOINT=...`
- PlayChat services: `productionBackendUrl=...`

---

For detailed guide, see `DEPLOY_AND_TEST.md`

