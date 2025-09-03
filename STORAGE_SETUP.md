# Firebase Storage Setup Guide

## 🚨 Storage Bucket Error Fix

If you're getting the error:
```
"The specified bucket does not exist"
```

This means your Firebase Storage bucket `gametibe2025.appspot.com` hasn't been created yet.

## 🔧 Quick Fix Options

### Option 1: Create the Bucket (Recommended)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: `gametibe2025`

2. **Enable Storage**
   - Click on "Storage" in the left sidebar
   - Click "Get started"
   - Choose "Start in test mode" (for development)
   - Select your preferred location (e.g., `us-central1`)
   - Click "Done"

3. **Verify Bucket Name**
   - The bucket should be named: `gametibe2025.appspot.com`
   - If it's different, update the `storageBucket` in `config/firebase.js`

### Option 2: Use Fallback Storage (Temporary)

The app now includes fallback storage that saves files locally when Firebase Storage is unavailable.

**Files will be saved to:** `backend/uploads/` directory

**Access files via:** `http://your-domain.com/uploads/filename`

## 🧪 Test Your Setup

Run the setup script to verify everything works:

```bash
cd backend
node scripts/setupStorage.js
```

This will:
- ✅ Check if the bucket exists
- ✅ Test file upload/download
- ✅ Verify permissions
- ✅ Provide troubleshooting tips

## 🔐 Service Account Permissions

Make sure your service account has these roles:
- **Storage Admin** (for full access)
- **Firebase Admin** (for authentication)

To check/update permissions:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `gametibe2025`
3. Go to "IAM & Admin" > "IAM"
4. Find your service account
5. Add "Storage Admin" role if missing

## 🌍 Environment Variables

Make sure these are set in your production environment:

```bash
# Firebase Configuration
FIREBASE_PROJECT_ID=gametibe2025
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@gametibe2025.iam.gserviceaccount.com"

# Storage Configuration (optional)
FALLBACK_STORAGE_URL=https://your-domain.com/uploads
```

## 🚀 Production Deployment

For production deployments (like Render):

1. **Create the storage bucket** (Option 1 above)
2. **Set environment variables** in your deployment platform
3. **Upload your `firebase-adminsdk.json`** file securely
4. **Test the setup** with the setup script

## 🔍 Troubleshooting

### Common Issues:

1. **"Bucket not found"**
   - Create the bucket in Firebase Console
   - Check bucket name matches exactly

2. **"Permission denied"**
   - Add "Storage Admin" role to service account
   - Verify service account email is correct

3. **"Invalid credentials"**
   - Check `firebase-adminsdk.json` file
   - Verify environment variables are set

4. **Files not accessible**
   - Check bucket permissions
   - Verify CORS settings for web access

### Debug Commands:

```bash
# Check Firebase connection
node -e "const admin = require('firebase-admin'); console.log('Firebase Admin SDK loaded')"

# Test storage access
node scripts/setupStorage.js

# Check environment variables
echo $FIREBASE_PROJECT_ID
```

## 📞 Support

If you're still having issues:

1. Check the Firebase Console for any error messages
2. Verify your project ID and bucket name
3. Ensure your service account has proper permissions
4. Try the fallback storage option temporarily

The app will now work with either Firebase Storage or local fallback storage! 🎉