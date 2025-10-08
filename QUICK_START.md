# 🚀 Quick Start: Deploy to Google Cloud Run

## In 5 Minutes!

### 1. Install Google Cloud SDK (one-time)

**Windows PowerShell (as Admin):**

```powershell
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

**After installation, restart your terminal and run:**

```bash
gcloud init
```

### 2. Login and Setup (one-time)

```bash
# Login
gcloud auth login

# Set project
gcloud config set project gametibe2025

# Enable APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 3. Deploy! (every time you update)

```bash
cd gametribe-backend

# Deploy with one command
gcloud run deploy gametribe-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 60 \
  --max-instances 10
```

**Follow the prompts:**

- Enable Cloud Build API? → **Y**
- Service name → Press Enter (use default)
- Region → **us-central1** (or closest to you)
- Allow unauthenticated? → **Y**

### 4. Set Environment Variables

```bash
# Get your Cloud Run service URL first
gcloud run services describe gametribe-backend --region us-central1 --format 'value(status.url)'

# Then set your environment variables
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-env-vars "
NODE_ENV=production,
STRIPE_SECRET_KEY=your_stripe_key,
STRIPE_WEBHOOK_SECRET=your_webhook_secret,
MPESA_CONSUMER_KEY=your_mpesa_key,
MPESA_CONSUMER_SECRET=your_mpesa_secret,
MPESA_SHORTCODE=your_shortcode,
MPESA_PASSKEY=your_passkey,
MPESA_CALLBACK_URL=https://YOUR_CLOUDRUN_URL/api/payments/mpesa/webhook,
FRONTEND_URL=http://localhost:5173
"
```

### 5. Update Frontend

Your Cloud Run URL will look like:
`https://gametribe-backend-xxxxx-uc.a.run.app`

Update `frontend/.env`:

```
VITE_API_URL=https://gametribe-backend-xxxxx-uc.a.run.app
VITE_BACKEND_URL=https://gametribe-backend-xxxxx-uc.a.run.app
```

### 6. Test It!

```bash
curl https://your-cloudrun-url/health
```

---

## Common Commands

### View Logs

```bash
gcloud run services logs read gametribe-backend --region us-central1 --follow
```

### Update Environment Variable

```bash
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-env-vars "VARIABLE_NAME=new_value"
```

### Scale Up/Down

```bash
# Set minimum instances (reduces cold starts but costs more)
gcloud run services update gametribe-backend \
  --region us-central1 \
  --min-instances 1

# Set maximum instances
gcloud run services update gametribe-backend \
  --region us-central1 \
  --max-instances 10
```

### Delete Service (if needed)

```bash
gcloud run services delete gametribe-backend --region us-central1
```

---

## Pricing (Free Tier)

✅ **2 Million requests/month FREE**
✅ **360,000 GB-seconds/month FREE**
✅ **180,000 vCPU-seconds/month FREE**

For a small to medium app, you'll likely stay within free tier!

---

## Troubleshooting

### "Permission Denied"

```bash
gcloud projects add-iam-policy-binding gametibe2025 \
  --member user:YOUR_EMAIL@gmail.com \
  --role roles/run.admin
```

### "Out of Memory"

```bash
gcloud run services update gametribe-backend \
  --region us-central1 \
  --memory 1Gi
```

### "Timeout"

```bash
gcloud run services update gametribe-backend \
  --region us-central1 \
  --timeout 300
```

---

## That's It! 🎉

Your backend is now running on Google Cloud Run with:

- ✅ Auto-scaling
- ✅ HTTPS by default
- ✅ Global CDN
- ✅ 99.95% uptime SLA
- ✅ Pay only for what you use
