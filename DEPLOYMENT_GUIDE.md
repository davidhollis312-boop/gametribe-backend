# GameTribe Backend Deployment to Google Cloud

## Prerequisites

1. Google Cloud account with billing enabled
2. Your Firebase project (gametibe2025)
3. Google Cloud SDK installed: https://cloud.google.com/sdk/docs/install
4. Docker installed (for local testing)

---

## Option 1: Google Cloud Run (RECOMMENDED) 🚀

### Why Cloud Run?

- ✅ Easiest deployment
- ✅ Auto-scales to zero (cost-effective)
- ✅ Pay per request
- ✅ 2M free requests/month
- ✅ No server management

### Step-by-Step Deployment

#### 1. Install Google Cloud SDK

```bash
# Windows (PowerShell as Admin)
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe

# Or download from: https://cloud.google.com/sdk/docs/install
```

#### 2. Initialize and Login

```bash
# Login to your Google account
gcloud auth login

# Set your Firebase project
gcloud config set project gametibe2025

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

#### 3. Update index.js for Cloud Run

Cloud Run uses PORT environment variable:

```javascript
// In index.js, change:
const PORT = process.env.PORT || 5000;
// to:
const PORT = process.env.PORT || 8080;
```

#### 4. Deploy to Cloud Run

```bash
cd gametribe-backend

# Build and deploy in one command
gcloud run deploy gametribe-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production

# You'll be prompted to:
# - Enable Cloud Build API (say yes)
# - Choose region (use us-central1 or closest to you)
# - Allow unauthenticated (yes for API)
```

#### 5. Set Environment Variables

```bash
# Set all your environment variables
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-env-vars "
STRIPE_SECRET_KEY=your_stripe_secret_key,
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret,
MPESA_CONSUMER_KEY=your_mpesa_key,
MPESA_CONSUMER_SECRET=your_mpesa_secret,
MPESA_SHORTCODE=your_shortcode,
MPESA_PASSKEY=your_passkey,
MPESA_CALLBACK_URL=https://your-cloudrun-url/api/payments/mpesa/webhook,
FRONTEND_URL=http://localhost:5173,
NODE_ENV=production
"
```

#### 6. Get Your Deployment URL

```bash
gcloud run services describe gametribe-backend \
  --region us-central1 \
  --format 'value(status.url)'
```

The URL will be something like: `https://gametribe-backend-xxxxx-uc.a.run.app`

#### 7. Update Frontend .env

```bash
# In frontend/.env
VITE_API_URL=https://gametribe-backend-xxxxx-uc.a.run.app
VITE_BACKEND_URL=https://gametribe-backend-xxxxx-uc.a.run.app
```

#### 8. Test Your Deployment

```bash
curl https://your-cloudrun-url/health
```

---

## Option 2: Google App Engine (Alternative)

### Deploy to App Engine

```bash
cd gametribe-backend

# Deploy
gcloud app deploy

# View logs
gcloud app logs tail -s default

# Get URL
gcloud app browse
```

Your URL will be: `https://gametibe2025.uc.r.appspot.com`

---

## Option 3: Firebase Cloud Functions (Requires Refactoring)

### Convert Express to Cloud Functions

This requires breaking your Express app into individual functions. Not recommended unless you need Firebase-specific features.

---

## Cost Comparison

### Cloud Run (RECOMMENDED)

- **Free Tier**: 2M requests/month, 360,000 GB-seconds, 180,000 vCPU-seconds
- **After Free Tier**: ~$0.40 per million requests
- **Storage**: First 0.5GB free

### App Engine

- **Free Tier**: 28 instance hours/day (F1 instance)
- **After Free Tier**: ~$0.05/hour (F1 instance)
- More expensive for low-traffic apps

### Cloud Functions

- **Free Tier**: 2M invocations/month
- Similar pricing to Cloud Run but more complex setup

---

## Managing Environment Variables

### Using Secret Manager (Recommended for sensitive data)

```bash
# Enable Secret Manager
gcloud services enable secretmanager.googleapis.com

# Create a secret
echo -n "your-stripe-secret-key" | gcloud secrets create stripe-secret-key --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding stripe-secret-key \
  --member serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role roles/secretmanager.secretAccessor

# Update Cloud Run to use secret
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-secrets STRIPE_SECRET_KEY=stripe-secret-key:latest
```

---

## Continuous Deployment with GitHub Actions

Create `.github/workflows/deploy-cloudrun.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - "gametribe-backend/**"

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/deploy-cloudrun@v1
        with:
          service: gametribe-backend
          source: ./gametribe-backend
          region: us-central1
```

---

## Monitoring and Logs

### View Logs

```bash
# Real-time logs
gcloud run services logs read gametribe-backend \
  --region us-central1 \
  --follow

# Or use Google Cloud Console
# https://console.cloud.google.com/run
```

### Set Up Alerts

```bash
# Cloud Monitoring is automatically enabled
# Set up alerts in: https://console.cloud.google.com/monitoring
```

---

## Custom Domain (Optional)

### Map Custom Domain

```bash
# Map domain to Cloud Run
gcloud run domain-mappings create \
  --service gametribe-backend \
  --domain api.gametribe.com \
  --region us-central1
```

---

## Troubleshooting

### Issue: "Permission Denied"

```bash
# Grant necessary permissions
gcloud projects add-iam-policy-binding gametibe2025 \
  --member user:your-email@gmail.com \
  --role roles/run.admin
```

### Issue: "Out of Memory"

```bash
# Increase memory
gcloud run services update gametribe-backend \
  --region us-central1 \
  --memory 512Mi
```

### Issue: "Cold Start Latency"

```bash
# Set minimum instances (costs more but faster)
gcloud run services update gametribe-backend \
  --region us-central1 \
  --min-instances 1
```

---

## Migration Checklist

- [ ] Install Google Cloud SDK
- [ ] Enable billing on Firebase project
- [ ] Update PORT in index.js to 8080
- [ ] Create Dockerfile
- [ ] Test locally with Docker
- [ ] Deploy to Cloud Run
- [ ] Set environment variables
- [ ] Update frontend .env
- [ ] Test all endpoints
- [ ] Update Stripe webhook URL
- [ ] Update M-Pesa callback URL
- [ ] Set up monitoring
- [ ] Configure custom domain (optional)

---

## Support

- Cloud Run Docs: https://cloud.google.com/run/docs
- Firebase Console: https://console.firebase.google.com
- Pricing Calculator: https://cloud.google.com/products/calculator

**Estimated Cost for Small Traffic**: $0-5/month with free tier
