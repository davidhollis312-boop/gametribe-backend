/**
 * Efficient In-Memory Cache System
 * Handles caching without external dependencies
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map();
    this.maxSize = 1000; // Maximum number of items
    this.cleanupInterval = 300000; // 5 minutes

    // Start cleanup interval
    setInterval(() => this.cleanup(), this.cleanupInterval);

    console.log("✅ In-memory cache system initialized");
  }

  /**
   * Set cache with TTL
   */
  set(key, value, ttlSeconds = 3600) {
    try {
      // Remove oldest items if cache is full
      if (this.cache.size >= this.maxSize) {
        this.evictOldest();
      }

      this.cache.set(key, value);
      this.ttl.set(key, Date.now() + ttlSeconds * 1000);

      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  /**
   * Get cache
   */
  get(key) {
    try {
      if (!this.cache.has(key)) {
        return null;
      }

      // Check if expired
      const expiry = this.ttl.get(key);
      if (expiry && Date.now() > expiry) {
        this.delete(key);
        return null;
      }

      return this.cache.get(key);
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  /**
   * Delete cache
   */
  delete(key) {
    try {
      this.cache.delete(key);
      this.ttl.delete(key);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.cache.has(key) && this.get(key) !== null;
  }

  /**
   * Get cache size
   */
  size() {
    return this.cache.size;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      hits: this.hits || 0,
      misses: this.misses || 0,
    };
  }

  /**
   * Cleanup expired items
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, expiry] of this.ttl.entries()) {
      if (now > expiry) {
        this.cache.delete(key);
        this.ttl.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: removed ${cleaned} expired items`);
    }
  }

  /**
   * Evict oldest items (LRU)
   */
  evictOldest() {
    const keys = Array.from(this.cache.keys());
    const toRemove = keys.slice(0, Math.floor(this.maxSize * 0.1)); // Remove 10%

    toRemove.forEach((key) => {
      this.cache.delete(key);
      this.ttl.delete(key);
    });
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

/**
 * Cache utility functions
 */
const cache = {
  // Set cache with TTL
  async set(key, value, ttl = 3600) {
    return cacheManager.set(key, value, ttl);
  },

  // Get cache
  async get(key) {
    return cacheManager.get(key);
  },

  // Delete cache
  async del(key) {
    return cacheManager.delete(key);
  },

  // Check if key exists
  async exists(key) {
    return cacheManager.has(key);
  },

  // Set multiple keys
  async mset(keyValuePairs, ttl = 3600) {
    try {
      for (const [key, value] of Object.entries(keyValuePairs)) {
        cacheManager.set(key, value, ttl);
      }
      return true;
    } catch (error) {
      console.error("Cache mset error:", error);
      return false;
    }
  },

  // Get multiple keys
  async mget(keys) {
    try {
      return keys.map((key) => cacheManager.get(key));
    } catch (error) {
      console.error("Cache mget error:", error);
      return [];
    }
  },

  // Increment counter
  async incr(key, ttl = 3600) {
    try {
      const current = cacheManager.get(key) || 0;
      const newValue = current + 1;
      cacheManager.set(key, newValue, ttl);
      return newValue;
    } catch (error) {
      console.error("Cache incr error:", error);
      return 0;
    }
  },

  // Get TTL
  async ttl(key) {
    try {
      const expiry = cacheManager.ttl.get(key);
      if (!expiry) return -1;
      return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
    } catch (error) {
      console.error("Cache TTL error:", error);
      return -1;
    }
  },
};

/**
 * Cache key generators
 */
const cacheKeys = {
  user: (userId) => `user:${userId}`,
  userProfile: (userId) => `user:profile:${userId}`,
  posts: (userId, page = 1) => `posts:${userId}:${page}`,
  post: (postId) => `post:${postId}`,
  leaderboard: (gameId) => `leaderboard:${gameId}`,
  gameScores: (userId, gameId) => `scores:${userId}:${gameId}`,
  rateLimit: (ip, endpoint) => `rate:${ip}:${endpoint}`,
  session: (sessionId) => `session:${sessionId}`,
};

/**
 * Cache TTL constants (in seconds)
 */
const CACHE_TTL = {
  USER_PROFILE: 3600, // 1 hour
  POSTS: 300, // 5 minutes
  POST: 1800, // 30 minutes
  LEADERBOARD: 300, // 5 minutes
  GAME_SCORES: 600, // 10 minutes
  RATE_LIMIT: 900, // 15 minutes
  SESSION: 86400, // 24 hours
};

module.exports = {
  cache,
  cacheKeys,
  CACHE_TTL,
  cacheManager,
};
