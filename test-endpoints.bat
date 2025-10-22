@echo off
echo ========================================
echo   Testing GameTribe Backend Endpoints
echo ========================================
echo.

REM Get project ID
for /f "tokens=2 delims=:" %%a in ('findstr "default" .firebaserc') do (
    for /f "tokens=1 delims=," %%b in ("%%a") do (
        set PROJECT_ID=%%b
    )
)
set PROJECT_ID=%PROJECT_ID:"=%
set PROJECT_ID=%PROJECT_ID: =%

set BASE_URL=https://us-central1-%PROJECT_ID%.cloudfunctions.net/api

echo Testing: %BASE_URL%
echo.

echo ========================================
echo Test 1: Basic API Test
echo ========================================
echo Endpoint: /api/test
echo.
curl -s %BASE_URL%/test
echo.
echo.

echo ========================================
echo Test 2: Firebase Connection Test
echo ========================================
echo Endpoint: /api/test-firebase
echo.
curl -s %BASE_URL%/test-firebase
echo.
echo.

echo ========================================
echo Test 3: Posts Endpoint (requires auth)
echo ========================================
echo Endpoint: /api/posts
echo.
curl -s %BASE_URL%/posts
echo.
echo.

echo ========================================
echo   Test Summary
echo ========================================
echo.
echo ✅ If you see JSON responses above, your backend is working!
echo ❌ If you see errors, check Firebase logs: firebase functions:log
echo.
echo Your Function URL: %BASE_URL%
echo.
pause


