# Vercel Environment Variables Setup

## 🔐 Required Environment Variables

Copy and paste these into your Vercel Dashboard → Settings → Environment Variables:

### Primary Encryption Key (Choose ONE)

```
CHALLENGE_ENCRYPTION_KEY=e5942369f19e082e945facd45c293412
```

### Alternative Keys (if you prefer)

```
CHALLENGE_ENCRYPTION_KEY=bca6bc5a83a0ca1705696a0a17b3dc49
CHALLENGE_ENCRYPTION_KEY=e0520351d2fc784c5286479dff25c902
CHALLENGE_ENCRYPTION_KEY=3377f07684f7b1b66b06c522e1d69107
CHALLENGE_ENCRYPTION_KEY=f131771afa5c01afb037dd2922eb05ad
```

### Additional Security Keys

```
HASH_SALT=GameTribe2024SaltKey1234567890
REQUEST_SIGNATURE_SECRET=GameTribe2024SignatureSecret1234567890
```

## 🚀 Setup Instructions

1. **Go to Vercel Dashboard**

   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Select your `gametribe-backend` project

2. **Navigate to Environment Variables**

   - Click **Settings** tab
   - Click **Environment Variables** in the sidebar

3. **Update the Key**

   - Find `CHALLENGE_ENCRYPTION_KEY`
   - Click **Edit**
   - Replace with: `e5942369f19e082e945facd45c293412`
   - Click **Save**

4. **Redeploy**
   - Go to **Deployments** tab
   - Click **Redeploy** on the latest deployment

## ⚠️ Important Notes

- **All existing challenges will be corrupted** after key change
- **Users will need to recreate challenges** after deployment
- **Keep the key secure** - don't share it publicly
- **The key must be exactly 32 characters** (hex format)

## 🧪 Testing

After deployment, test by:

1. Creating a new challenge
2. Trying to cancel it
3. Should work without decryption errors

## 🔄 Migration (Optional)

If you want to preserve existing challenges, you'd need to:

1. Export all challenges from Firebase
2. Decrypt with old key
3. Re-encrypt with new key
4. Import back to Firebase

This is complex and not recommended unless absolutely necessary.
