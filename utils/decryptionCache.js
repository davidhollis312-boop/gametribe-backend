/**
 * Decryption Cache - Cache decrypted challenge data to avoid repeated decryption
 */

class DecryptionCache {
  constructor(maxSize = 100, ttl = 300000) {
    // 5 minutes TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  /**
   * Get cached decrypted data
   */
  get(challengeId) {
    const cached = this.cache.get(challengeId);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(challengeId);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached decrypted data
   */
  set(challengeId, data) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(challengeId, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
}

// Global cache instance
const decryptionCache = new DecryptionCache();

/**
 * Cached decryption function
 */
const decryptDataCached = (encryptedData, encryptionKey, challengeId) => {
  // Try cache first
  const cached = decryptionCache.get(challengeId);
  if (cached) {
    console.log(`📦 Cache hit for challenge ${challengeId}`);
    return cached;
  }

  // Decrypt and cache
  const { decryptData } = require("./encryption");
  const decryptedData = decryptData(encryptedData, encryptionKey);

  decryptionCache.set(challengeId, decryptedData);
  console.log(`🔓 Decrypted and cached challenge ${challengeId}`);

  return decryptedData;
};

module.exports = {
  DecryptionCache,
  decryptionCache,
  decryptDataCached,
};
