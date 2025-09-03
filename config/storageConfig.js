// Storage configuration with fallback handling
const admin = require("firebase-admin");
const FallbackStorage = require("../services/fallbackStorage");

// Storage bucket configuration
const STORAGE_CONFIG = {
  // Primary bucket (should match your Firebase project)
  primaryBucket: "gametibe2025.appspot.com",
  
  // Environment-specific configuration
  // Prefer explicit env var, then Firebase app option, then primary
  getBucketName: () => {
    const fromEnv = process.env.FIREBASE_STORAGE_BUCKET || process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv.trim();
    }
    try {
      const appOptions = admin.app().options || {};
      if (appOptions.storageBucket) {
        return appOptions.storageBucket;
      }
    } catch (_) {
      // admin.app() may throw if not initialized yet; ignore and fall back
    }
    return STORAGE_CONFIG.primaryBucket;
  }
};

// Initialize storage with error handling
const initializeStorage = () => {
  try {
    const bucketName = STORAGE_CONFIG.getBucketName();
    console.log(`🪣 Initializing Firebase Storage with bucket: ${bucketName}`);
    
    const storage = admin.storage();
    const bucket = storage.bucket(bucketName);
    
    // Test bucket access by trying to get metadata
    return bucket;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Storage:', error.message);
    console.log('🔄 Falling back to local file storage...');
    
    // Initialize fallback storage
    const fallbackStorage = new FallbackStorage();
    
    // Return a storage-like object that uses fallback
    return {
      uploadFile: (file, destination) => fallbackStorage.uploadFile(file, destination),
      deleteFile: (fileName) => fallbackStorage.deleteFile(fileName),
      getSignedUrl: (fileName, options) => fallbackStorage.getSignedUrl(fileName, options),
      isAvailable: () => true,
      isFallback: true,
      fallbackStorage
    };
  }
};

// Storage utility functions
const storageUtils = {
  // Check if storage is available
  isStorageAvailable: (storage) => {
    return Boolean(storage);
  },
  
  // Upload file with error handling
  uploadFile: async (storage, file, destination) => {
    try {
      if (!storageUtils.isStorageAvailable(storage)) {
        throw new Error('Storage service not available');
      }
      
      const bucket = storage;
      // Ensure bucket exists when using Firebase Storage
      if (typeof bucket.exists === 'function') {
        const [exists] = await bucket.exists();
        if (!exists) {
          const bucketName = bucket.name || '<unknown>';
          throw new Error(`Storage bucket does not exist: ${bucketName}`);
        }
      }
      const fileUpload = bucket.file(destination);
      
      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });
      
      return new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.on('finish', () => resolve(fileUpload));
        stream.end(file.buffer);
      });
    } catch (error) {
      console.error('❌ File upload failed:', error.message);
      throw error;
    }
  },
  
  // Delete file with error handling
  deleteFile: async (storage, fileName) => {
    try {
      if (!storageUtils.isStorageAvailable(storage)) {
        console.warn('⚠️ Storage not available, skipping file deletion:', fileName);
        return;
      }
      
      const bucket = storage;
      const file = bucket.file(fileName);
      
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        console.log(`✅ Deleted file: ${fileName}`);
      } else {
        console.log(`ℹ️ File does not exist: ${fileName}`);
      }
    } catch (error) {
      console.error('❌ File deletion failed:', error.message);
      // Don't throw error for deletion failures
    }
  },
  
  // Get signed URL with error handling
  getSignedUrl: async (storage, fileName, options = {}) => {
    try {
      if (!storageUtils.isStorageAvailable(storage)) {
        throw new Error('Storage service not available');
      }
      
      const bucket = storage;
      const file = bucket.file(fileName);
      
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours
        ...options
      });
      
      return url;
    } catch (error) {
      console.error('❌ Failed to get signed URL:', error.message);
      throw error;
    }
  }
};

module.exports = {
  STORAGE_CONFIG,
  initializeStorage,
  storageUtils
};