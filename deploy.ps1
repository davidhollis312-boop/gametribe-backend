# GameTribe Backend - Deploy to Google Cloud Run
# Run this script in PowerShell

Write-Host "🚀 Deploying GameTribe Backend to Google Cloud Run..." -ForegroundColor Green

# Check if gcloud is installed
try {
    $gcloudVersion = gcloud version
    Write-Host "✅ Google Cloud SDK found" -ForegroundColor Green
} catch {
    Write-Host "❌ Google Cloud SDK not found. Please install it first:" -ForegroundColor Red
    Write-Host "Run: (New-Object Net.WebClient).DownloadFile('https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe', `"`$env:Temp\GoogleCloudSDKInstaller.exe'); & `$env:Temp\GoogleCloudSDKInstaller.exe" -ForegroundColor Yellow
    exit 1
}

# Check if logged in
try {
    $account = gcloud auth list --filter=status:ACTIVE --format="value(account)"
    if (-not $account) {
        Write-Host "❌ Not logged in to Google Cloud. Running login..." -ForegroundColor Yellow
        gcloud auth login
    } else {
        Write-Host "✅ Logged in as: $account" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error checking auth status. Please run: gcloud auth login" -ForegroundColor Red
    exit 1
}

# Set project
Write-Host "`n📦 Setting project to gametibe2025..." -ForegroundColor Cyan
gcloud config set project gametibe2025

# Enable required APIs
Write-Host "`n🔧 Enabling required APIs..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet
gcloud services enable containerregistry.googleapis.com --quiet

Write-Host "✅ APIs enabled" -ForegroundColor Green

# Deploy
Write-Host "`n🚀 Deploying to Cloud Run..." -ForegroundColor Cyan
Write-Host "This may take 2-3 minutes..." -ForegroundColor Yellow

gcloud run deploy gametribe-backend `
  --source . `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --memory 512Mi `
  --timeout 60 `
  --max-instances 10 `
  --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Deployment successful!" -ForegroundColor Green
    
    # Get service URL
    $serviceUrl = gcloud run services describe gametribe-backend --region us-central1 --format 'value(status.url)'
    
    Write-Host "`n📋 Your Backend URL:" -ForegroundColor Cyan
    Write-Host $serviceUrl -ForegroundColor Yellow
    
    Write-Host "`n📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Set environment variables:" -ForegroundColor White
    Write-Host "   gcloud run services update gametribe-backend --region us-central1 --set-env-vars 'NODE_ENV=production,...'" -ForegroundColor Gray
    Write-Host "`n2. Update frontend/.env:" -ForegroundColor White
    Write-Host "   VITE_API_URL=$serviceUrl" -ForegroundColor Gray
    Write-Host "   VITE_BACKEND_URL=$serviceUrl" -ForegroundColor Gray
    Write-Host "`n3. Test your deployment:" -ForegroundColor White
    Write-Host "   curl $serviceUrl/health" -ForegroundColor Gray
    
    Write-Host "`n📊 View logs:" -ForegroundColor Cyan
    Write-Host "   gcloud run services logs read gametribe-backend --region us-central1 --follow" -ForegroundColor Gray
    
    Write-Host "`n🎉 Deployment Complete!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Deployment failed. Check the errors above." -ForegroundColor Red
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Missing permissions: Run 'gcloud projects add-iam-policy-binding gametibe2025 --member user:YOUR_EMAIL --role roles/run.admin'" -ForegroundColor Gray
    Write-Host "  - Billing not enabled: Enable billing at https://console.cloud.google.com/billing" -ForegroundColor Gray
    exit 1
}
