@echo off
echo ========================================
echo   GameTribe Backend - Deploy & Test
echo ========================================
echo.

REM Check Firebase CLI
firebase --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing Firebase CLI...
    call npm install -g firebase-tools
    echo.
)

REM Login to Firebase
echo 🔐 Checking Firebase login...
firebase projects:list >nul 2>&1
if errorlevel 1 (
    echo Please login to Firebase...
    firebase login
)

echo.
echo ========================================
echo   Step 1: Generate Security Keys
echo ========================================
echo.

REM Generate keys
echo Generating CHALLENGE_ENCRYPTION_KEY...
for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set ENCRYPTION_KEY=%%i

echo Generating MOBILE_APP_SECRET...
for /f "delims=" %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set MOBILE_SECRET=%%i

echo.
echo ✅ Keys generated successfully!
echo.

REM Create .env file
echo Creating .env file...
(
echo # GameTribe Backend Environment Variables
echo # Generated: %date% %time%
echo.
echo # CRITICAL SECURITY ^(Required^)
echo CHALLENGE_ENCRYPTION_KEY=%ENCRYPTION_KEY%
echo MOBILE_APP_SECRET=%MOBILE_SECRET%
echo.
echo # NODE ENVIRONMENT
echo NODE_ENV=production
echo.
echo # Add other variables as needed:
echo # STRIPE_SECRET_KEY=sk_live_xxx
echo # ALLOWED_ORIGINS=https://your-frontend.com
) > .env

echo ✅ .env file created!
echo.

echo ========================================
echo   Step 2: Install Dependencies
echo ========================================
echo.
call npm install

echo.
echo ========================================
echo   Step 3: Deploy to Firebase
echo ========================================
echo.
firebase deploy

echo.
echo ========================================
echo   Step 4: Test Deployment
echo ========================================
echo.

REM Get project ID from .firebaserc
for /f "tokens=2 delims=:" %%a in ('findstr "default" .firebaserc') do (
    for /f "tokens=1 delims=," %%b in ("%%a") do (
        set PROJECT_ID=%%b
    )
)
set PROJECT_ID=%PROJECT_ID:"=%
set PROJECT_ID=%PROJECT_ID: =%

set BASE_URL=https://us-central1-%PROJECT_ID%.cloudfunctions.net/api

echo Testing endpoint: %BASE_URL%/test
echo.
curl -s %BASE_URL%/test
echo.
echo.

echo Testing endpoint: %BASE_URL%/test-firebase
echo.
curl -s %BASE_URL%/test-firebase
echo.
echo.

echo ========================================
echo   Deployment Complete! 🎉
echo ========================================
echo.
echo Your backend is live at:
echo %BASE_URL%
echo.
echo ✅ Test endpoints are working!
echo.
echo Next steps:
echo 1. Update frontend .env with: %BASE_URL%
echo 2. Update PlayChat service URLs
echo 3. Test authentication
echo 4. Test challenge creation
echo.
echo View logs with: firebase functions:log
echo.
pause


