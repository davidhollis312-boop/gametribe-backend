# Set Environment Variables for Cloud Run
# Edit the values below with your actual keys

Write-Host "🔐 Setting environment variables for Cloud Run..." -ForegroundColor Green

# EDIT THESE VALUES
$envVars = @{
    "NODE_ENV" = "production"
    "STRIPE_SECRET_KEY" = "your_stripe_secret_key_here"
    "STRIPE_WEBHOOK_SECRET" = "your_stripe_webhook_secret_here"
    "MPESA_CONSUMER_KEY" = "your_mpesa_consumer_key_here"
    "MPESA_CONSUMER_SECRET" = "your_mpesa_consumer_secret_here"
    "MPESA_SHORTCODE" = "your_mpesa_shortcode_here"
    "MPESA_PASSKEY" = "your_mpesa_passkey_here"
    "MPESA_CALLBACK_URL" = "https://YOUR_CLOUDRUN_URL/api/payments/mpesa/webhook"
    "MPESA_ENVIRONMENT" = "sandbox"  # or "production"
    "FRONTEND_URL" = "http://localhost:5173"  # Update with your production URL
}

# Build the env vars string
$envVarsString = ($envVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join ","

Write-Host "`n📋 Environment variables to set:" -ForegroundColor Cyan
$envVars.GetEnumerator() | ForEach-Object { 
    if ($_.Key -like "*SECRET*" -or $_.Key -like "*KEY*" -or $_.Key -like "*PASSKEY*") {
        Write-Host "  $($_.Key) = ********" -ForegroundColor Gray
    } else {
        Write-Host "  $($_.Key) = $($_.Value)" -ForegroundColor Gray
    }
}

Write-Host "`n⚠️  WARNING: Make sure you've edited this script with your actual values!" -ForegroundColor Yellow
$confirmation = Read-Host "`nHave you updated the values above? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "`n❌ Aborted. Please edit set-env-vars.ps1 with your actual values first." -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Updating Cloud Run service..." -ForegroundColor Green

# Update the service
gcloud run services update gametribe-backend `
  --region us-central1 `
  --set-env-vars $envVarsString

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Environment variables set successfully!" -ForegroundColor Green
    Write-Host "`n📋 Verify your settings at:" -ForegroundColor Cyan
    Write-Host "   https://console.cloud.google.com/run/detail/us-central1/gametribe-backend" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Failed to set environment variables." -ForegroundColor Red
    exit 1
}
