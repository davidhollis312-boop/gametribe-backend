# 🚀 GameTribe Backend - Google Cloud Deployment

Your backend is ready to deploy to Google Cloud Run! This replaces Vercel and gives you:

- ✅ **2 Million free requests/month**
- ✅ **Auto-scaling** (scales to zero when not in use)
- ✅ **No cold starts** with proper configuration
- ✅ **Built-in HTTPS**
- ✅ **99.95% uptime SLA**

---

## 🎯 Quick Deploy (3 Steps)

### Step 1: Install Google Cloud SDK

**Windows (PowerShell as Admin):**

```powershell
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

**After installation:**

```bash
# Restart your terminal
gcloud init
# Login when prompted
# Select project: gametibe2025
```

### Step 2: Deploy

**Option A - Using PowerShell Script (Easiest):**

```powershell
cd gametribe-backend
.\deploy.ps1
```

**Option B - Manual Command:**

```bash
cd gametribe-backend

gcloud run deploy gametribe-backend \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi
```

### Step 3: Set Environment Variables

1. Edit `set-env-vars.ps1` with your actual keys
2. Run it:

```powershell
.\set-env-vars.ps1
```

**Or set manually:**

```bash
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-env-vars "NODE_ENV=production,STRIPE_SECRET_KEY=sk_xxx,..."
```

---

## 📦 What's Included

All these files have been created for you:

| File                  | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `Dockerfile`          | Containerizes your Express app             |
| `.dockerignore`       | Excludes unnecessary files from container  |
| `QUICK_START.md`      | 5-minute deployment guide                  |
| `DEPLOYMENT_GUIDE.md` | Complete deployment documentation          |
| `deploy.ps1`          | PowerShell deployment script               |
| `set-env-vars.ps1`    | Environment variables script               |
| `app.yaml`            | App Engine config (alternative deployment) |
| `cloudbuild.yaml`     | Automated CI/CD configuration              |

---

## 🔧 Configuration Changes Made

### `index.js` Updated

```javascript
// Changed from:
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {...});

// To:
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {...});
```

**Why?**

- Cloud Run requires `0.0.0.0` binding
- Cloud Run sets `PORT` environment variable dynamically
- Default 8080 is Cloud Run standard

---

## 🌐 After Deployment

### 1. Get Your Service URL

```bash
gcloud run services describe gametribe-backend \
  --region us-central1 \
  --format 'value(status.url)'
```

Example: `https://gametribe-backend-xxxxx-uc.a.run.app`

### 2. Update Frontend

Edit `frontend/.env`:

```env
VITE_API_URL=https://gametribe-backend-xxxxx-uc.a.run.app
VITE_BACKEND_URL=https://gametribe-backend-xxxxx-uc.a.run.app
```

### 3. Update Webhook URLs

**Stripe:**

- Go to Stripe Dashboard → Webhooks
- Add endpoint: `https://your-cloudrun-url/api/payments/stripe/webhook`

**M-Pesa:**

- Update your M-Pesa callback URL in environment variables:

```bash
MPESA_CALLBACK_URL=https://your-cloudrun-url/api/payments/mpesa/webhook
```

### 4. Test Everything

```bash
# Health check
curl https://your-cloudrun-url/health

# API test
curl https://your-cloudrun-url/api/users/health
```

---

## 📊 Monitoring

### View Logs (Real-time)

```bash
gcloud run services logs read gametribe-backend \
  --region us-central1 \
  --follow
```

### Cloud Console

Visit: https://console.cloud.google.com/run/detail/us-central1/gametribe-backend

You can see:

- Request count
- Latency
- Error rate
- Memory usage
- Active instances

---

## 💰 Cost Optimization

### Current Setup (Free Tier Friendly)

```yaml
Memory: 512Mi # Good for most APIs
Timeout: 60s # Enough for slow operations
Max Instances: 10 # Prevents runaway costs
Min Instances: 0 # Scales to zero (free)
```

### If You Need Better Performance

```bash
# Set minimum instances (faster but costs ~$10/month per instance)
gcloud run services update gametribe-backend \
  --region us-central1 \
  --min-instances 1
```

### Estimated Costs

**Low Traffic (Within Free Tier):**

- 0-2M requests/month: **$0**

**Medium Traffic:**

- 5M requests/month: **~$2-5/month**

**High Traffic:**

- 20M requests/month: **~$20-30/month**

Still **much cheaper** than Vercel Pro ($20/month base + usage)!

---

## 🔄 Continuous Deployment

### Manual Redeployment

```bash
# Just run deploy script again
.\deploy.ps1
```

### Automatic with GitHub Actions

See `cloudbuild.yaml` for CI/CD setup.

---

## 🛠️ Common Commands

### Update Environment Variable

```bash
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-env-vars "NEW_VAR=value"
```

### Increase Memory

```bash
gcloud run services update gametribe-backend \
  --region us-central1 \
  --memory 1Gi
```

### Scale Settings

```bash
# Set max instances
gcloud run services update gametribe-backend \
  --region us-central1 \
  --max-instances 20

# Set min instances (costs more but eliminates cold starts)
gcloud run services update gametribe-backend \
  --region us-central1 \
  --min-instances 1
```

### View Service Details

```bash
gcloud run services describe gametribe-backend --region us-central1
```

### Delete Service

```bash
gcloud run services delete gametribe-backend --region us-central1
```

---

## 🐛 Troubleshooting

### Issue: Permission Denied

```bash
gcloud projects add-iam-policy-binding gametibe2025 \
  --member user:your-email@gmail.com \
  --role roles/run.admin
```

### Issue: Out of Memory

```bash
# Increase to 1GB
gcloud run services update gametribe-backend \
  --region us-central1 \
  --memory 1Gi
```

### Issue: Timeout Errors

```bash
# Increase timeout to 5 minutes
gcloud run services update gametribe-backend \
  --region us-central1 \
  --timeout 300
```

### Issue: Cold Starts

```bash
# Keep 1 instance always running
gcloud run services update gametribe-backend \
  --region us-central1 \
  --min-instances 1
```

### Issue: Build Failed

- Check Dockerfile syntax
- Ensure all dependencies in package.json
- Check logs: `gcloud builds list`

---

## 🔒 Security Best Practices

### Use Secret Manager (Recommended)

```bash
# Enable Secret Manager
gcloud services enable secretmanager.googleapis.com

# Create secret
echo -n "your_secret_value" | gcloud secrets create my-secret --data-file=-

# Use in Cloud Run
gcloud run services update gametribe-backend \
  --region us-central1 \
  --set-secrets STRIPE_SECRET_KEY=stripe-secret:latest
```

### Enable HTTPS Only

```bash
# Already enabled by default in Cloud Run ✅
```

### Restrict Access (Optional)

```bash
# Require authentication (if needed)
gcloud run services update gametribe-backend \
  --region us-central1 \
  --no-allow-unauthenticated
```

---

## 📚 Resources

- **Cloud Run Docs**: https://cloud.google.com/run/docs
- **Pricing Calculator**: https://cloud.google.com/products/calculator
- **Firebase Console**: https://console.firebase.google.com
- **Cloud Console**: https://console.cloud.google.com

---

## ✅ Deployment Checklist

- [ ] Google Cloud SDK installed
- [ ] Logged in (`gcloud auth login`)
- [ ] Project set (`gcloud config set project gametibe2025`)
- [ ] Backend deployed (`.\deploy.ps1`)
- [ ] Environment variables set (`.\set-env-vars.ps1`)
- [ ] Frontend .env updated with Cloud Run URL
- [ ] Stripe webhook URL updated
- [ ] M-Pesa callback URL updated
- [ ] Health check tested (`curl https://your-url/health`)
- [ ] API endpoints tested
- [ ] Logs checked (`gcloud run services logs read...`)

---

## 🎉 Success!

Your backend is now running on Google Cloud Run with:

- ✅ Auto-scaling
- ✅ Global CDN
- ✅ HTTPS by default
- ✅ 99.95% uptime
- ✅ Pay only for what you use

**Need Help?**

- Check logs: `gcloud run services logs read gametribe-backend --region us-central1 --follow`
- View metrics: https://console.cloud.google.com/run
- Read docs: `DEPLOYMENT_GUIDE.md` or `QUICK_START.md`
