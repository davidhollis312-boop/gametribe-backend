# GameTribe Backend

Backend API for GameTribe Community Platform - A gaming community hub with challenges, payments, and social features.

## 🚀 Quick Links

- **[Local Development Setup](LOCAL_DEV_SETUP.md)** - Get started with local development
- **[Vercel Deployment](VERCEL_DEPLOYMENT.md)** - Deploy to production
- **[Deployment Summary](DEPLOYMENT_SUMMARY.md)** - Recent changes and next steps

## 📋 Overview

This is a Node.js/Express backend providing:

- 🎮 **Challenge System** - Create and manage gaming challenges with betting
- 💰 **Payments** - Stripe and M-Pesa integration
- 👥 **User Management** - Authentication, profiles, and wallets
- 💬 **Social Features** - Posts, clans, messages, and events
- 🎯 **Leaderboards** - Game scores and rankings
- 🔍 **Search** - Full-text search across content
- 📊 **Analytics** - Usage tracking and monitoring

## 🏃‍♂️ Quick Start

### Local Development

```bash
# 1. Install dependencies
cd gametribe-backend
npm install

# 2. Create .env file
cp config/production.env.example .env

# 3. Configure environment variables (see LOCAL_DEV_SETUP.md)
nano .env

# 4. Start server
npm start
```

Server runs on `http://localhost:5000`

### Deploy to Vercel

```bash
# Via CLI
vercel

# Or use Vercel Dashboard (recommended)
# See VERCEL_DEPLOYMENT.md for detailed instructions
```

## 🔧 Configuration

### Required Environment Variables

| Variable                        | Description                             | Example                          |
| ------------------------------- | --------------------------------------- | -------------------------------- |
| `FRONTEND_URL`                  | Frontend domain (REQUIRED for payments) | `https://hub.gametribe.com`      |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase admin credentials              | `{"type":"service_account",...}` |
| `FIREBASE_DATABASE_URL`         | Firebase Realtime Database URL          | `https://project.firebaseio.com` |
| `FIREBASE_STORAGE_BUCKET`       | Firebase Storage bucket                 | `project.firebasestorage.app`    |
| `JWT_SECRET`                    | JWT signing secret                      | Any secure random string         |
| `CHALLENGE_ENCRYPTION_KEY`      | Challenge encryption key (32 chars)     | Any 32-character string          |

### Optional: Payment Providers

**Stripe** (card payments):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

**M-Pesa** (mobile money):

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`
- `MPESA_ENVIRONMENT`

See `config/production.env.example` for full list.

## 📡 API Endpoints

### Health Check

```bash
GET /health
```

### Main Routes

- `/api/auth` - Authentication
- `/api/users` - User management
- `/api/posts` - Community posts
- `/api/challenges` - Gaming challenges
- `/api/payments` - Stripe & M-Pesa
- `/api/wallet` - User wallets
- `/api/clans` - Clan management
- `/api/events` - Gaming events
- `/api/leaderboard` - Leaderboards
- `/api/games` - Game library
- `/api/game-scores` - Score tracking
- `/api/notifications` - Push notifications
- `/api/messages` - Direct messaging
- `/api/search` - Content search
- `/api/analytics` - Usage analytics

## 🔐 Security Features

- ✅ JWT authentication
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Input sanitization
- ✅ File upload validation
- ✅ Challenge encryption
- ✅ Anti-fraud checks
- ✅ Request signature verification

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Realtime Database
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth
- **Payments**: Stripe, M-Pesa (Daraja API)
- **Rate Limiting**: express-rate-limit
- **File Uploads**: multer

## 📁 Project Structure

```
gametribe-backend/
├── config/              # Configuration files
│   ├── firebase.js      # Firebase setup
│   ├── email.js         # Email configuration
│   └── *.env.example    # Environment examples
├── controllers/         # Business logic
│   ├── payment.js       # Payment processing
│   ├── challengeController.js
│   ├── users.js
│   └── ...
├── middleware/          # Express middleware
│   ├── auth.js          # Authentication
│   ├── rateLimiter.js   # Rate limiting
│   ├── fileValidator.js # File validation
│   └── ...
├── routes/              # API routes
│   ├── payment.js
│   ├── challenges.js
│   ├── users.js
│   └── ...
├── services/            # External services
│   ├── emailService.js
│   ├── search.js
│   └── ...
├── utils/               # Utilities
│   ├── mpesaConfig.js
│   ├── encryption.js
│   └── ...
├── index.js             # Server entry point
├── package.json         # Dependencies
├── vercel.json          # Vercel config
└── .env                 # Environment variables (create this)
```

## 🐛 Troubleshooting

### Payment Redirects to Localhost

**Solution**: Set `FRONTEND_URL` environment variable

### M-Pesa Token Generation Fails

**Solution**:

1. Verify all M-Pesa env vars are set
2. Check `MPESA_SHORTCODE` is 6 digits
3. Ensure `MPESA_CALLBACK_URL` uses HTTPS

### CORS Errors

**Solution**: Update `ALLOWED_ORIGINS` to include frontend domain

### Firebase Errors

**Solution**: Verify Firebase credentials and URLs are correct

See [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) for more troubleshooting.

## 📚 Documentation

- **[Local Development Setup](LOCAL_DEV_SETUP.md)** - Set up local development environment
- **[Vercel Deployment Guide](VERCEL_DEPLOYMENT.md)** - Deploy to Vercel with detailed steps
- **[Deployment Summary](DEPLOYMENT_SUMMARY.md)** - Recent changes and migration from Cloud Run
- **[Challenge System](CHALLENGE_SYSTEM.md)** - Challenge system documentation (if exists)
- **[Environment Setup](ENVIRONMENT_SETUP.md)** - Environment configuration guide (if exists)

## 🔄 Recent Changes

- ✅ Removed Cloud Run deployment files
- ✅ Configured for Vercel deployment
- ✅ Fixed payment redirect URLs to use `FRONTEND_URL`
- ✅ Updated M-Pesa configuration for Vercel
- ✅ Created comprehensive deployment documentation

See [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) for details.

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Set all required environment variables in Vercel
- [ ] Set `FRONTEND_URL` to your actual frontend domain
- [ ] Configure payment provider credentials (Stripe/M-Pesa)
- [ ] Update `ALLOWED_ORIGINS` with frontend domain
- [ ] Update Stripe webhook URL (if using Stripe)
- [ ] Update M-Pesa callback URL (if using M-Pesa)
- [ ] Test payment flow end-to-end
- [ ] Verify no CORS errors
- [ ] Check Vercel logs for errors

## 📊 Monitoring

- Check Vercel deployment logs
- Monitor function execution logs
- Track API response times
- Review error rates

## 🤝 Support

For issues or questions:

1. Check the documentation in this repository
2. Review Vercel deployment logs
3. Test endpoints with the `/health` check
4. Verify environment variables are set correctly

## 📝 License

[Your License Here]

## 👥 Contributors

[Your Team/Contributors Here]

---

**Need help?** Check out the documentation files or contact the development team.
