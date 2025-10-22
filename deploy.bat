@echo off
echo ========================================
echo   Firebase Backend Deployment
echo ========================================
echo.

REM Check if firebase-tools is installed
firebase --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Firebase CLI not installed
    echo.
    echo Installing Firebase CLI globally...
    npm install -g firebase-tools
    echo.
    echo ✅ Firebase CLI installed
    echo.
)

echo 🔐 Checking Firebase login...
firebase login:ci
if errorlevel 1 (
    echo.
    echo Please login to Firebase...
    firebase login
)

echo.
echo 📦 Installing dependencies...
call npm install

echo.
echo 🚀 Deploying to Firebase...
firebase deploy --only functions,database

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Your backend is now live at:
echo https://us-central1-YOUR-PROJECT-ID.cloudfunctions.net/api
echo.
echo Next steps:
echo 1. Update frontend .env with the function URL
echo 2. Update PlayChat service URLs
echo 3. Test all endpoints
echo.
pause


