// ✅ NEW: Simple in-memory caching service (Redis replacement)
class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 300; // 5 minutes default TTL
    this.cleanupInterval = 60000; // 1 minute cleanup interval

    // Start cleanup interval
    this.startCleanup();

    console.log("✅ In-memory cache service initialized");
  }

  // Generic cache operations
  async get(key) {
    try {
      const item = this.cache.get(key);
      if (!item) return null;

      // Check if expired
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.cache.delete(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
      this.cache.set(key, {
        value,
        expiresAt,
        createdAt: Date.now(),
      });
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  async del(key) {
    try {
      return this.cache.delete(key);
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  async exists(key) {
    try {
      const item = this.cache.get(key);
      if (!item) return false;

      // Check if expired
      if (item.expiresAt && Date.now() > item.expiresAt) {
        this.cache.delete(key);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Cache exists error:", error);
      return false;
    }
  }

  // Posts-specific caching
  async getPosts(
    page = 1,
    limit = 20,
    category = null,
    authorId = null,
    clanId = null
  ) {
    const key = `posts:${page}:${limit}:${category || "all"}:${
      authorId || "all"
    }:${clanId || "all"}`;
    return await this.get(key);
  }

  async setPosts(
    posts,
    page = 1,
    limit = 20,
    category = null,
    authorId = null,
    clanId = null,
    ttl = 300
  ) {
    const key = `posts:${page}:${limit}:${category || "all"}:${
      authorId || "all"
    }:${clanId || "all"}`;
    return await this.set(key, posts, ttl);
  }

  async invalidatePosts() {
    try {
      const keysToDelete = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith("posts:")) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach((key) => this.cache.delete(key));
      return true;
    } catch (error) {
      console.error("Cache invalidation error:", error);
      return false;
    }
  }

  // User-specific caching
  async getUser(userId) {
    const key = `user:${userId}`;
    return await this.get(key);
  }

  async setUser(userId, userData, ttl = 600) {
    const key = `user:${userId}`;
    return await this.set(key, userData, ttl);
  }

  async invalidateUser(userId) {
    const key = `user:${userId}`;
    return await this.del(key);
  }

  // Post-specific caching
  async getPost(postId) {
    const key = `post:${postId}`;
    return await this.get(key);
  }

  async setPost(postId, postData, ttl = 600) {
    const key = `post:${postId}`;
    return await this.set(key, postData, ttl);
  }

  async invalidatePost(postId) {
    const key = `post:${postId}`;
    return await this.del(key);
  }

  // Comments caching
  async getComments(postId) {
    const key = `comments:${postId}`;
    return await this.get(key);
  }

  async setComments(postId, comments, ttl = 300) {
    const key = `comments:${postId}`;
    return await this.set(key, comments, ttl);
  }

  async invalidateComments(postId) {
    const key = `comments:${postId}`;
    return await this.del(key);
  }

  // Search results caching
  async getSearchResults(query, page = 1, limit = 20) {
    const key = `search:${query}:${page}:${limit}`;
    return await this.get(key);
  }

  async setSearchResults(query, results, page = 1, limit = 20, ttl = 600) {
    const key = `search:${query}:${page}:${limit}`;
    return await this.set(key, results, ttl);
  }

  // Analytics caching
  async getAnalytics(type, timeRange = "24h") {
    const key = `analytics:${type}:${timeRange}`;
    return await this.get(key);
  }

  async setAnalytics(type, data, timeRange = "24h", ttl = 3600) {
    const key = `analytics:${type}:${timeRange}`;
    return await this.set(key, data, ttl);
  }

  // Rate limiting
  async incrementRateLimit(key, window = 60) {
    try {
      const current = (await this.get(key)) || 0;
      const newValue = current + 1;
      await this.set(key, newValue, window);
      return newValue;
    } catch (error) {
      console.error("Rate limit increment error:", error);
      return 0;
    }
  }

  async getRateLimit(key) {
    try {
      return (await this.get(key)) || 0;
    } catch (error) {
      console.error("Rate limit get error:", error);
      return 0;
    }
  }

  // Session caching
  async getSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  async setSession(sessionId, sessionData, ttl = 86400) {
    const key = `session:${sessionId}`;
    return await this.set(key, sessionData, ttl);
  }

  async invalidateSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.del(key);
  }

  // Cache statistics
  async getStats() {
    try {
      const now = Date.now();
      let totalItems = 0;
      let expiredItems = 0;
      let memoryUsage = 0;

      for (const [key, item] of this.cache.entries()) {
        totalItems++;
        if (item.expiresAt && now > item.expiresAt) {
          expiredItems++;
        }
        // Rough memory estimation
        memoryUsage += JSON.stringify(item).length;
      }

      return {
        totalItems,
        expiredItems,
        memoryUsageBytes: memoryUsage,
        memoryUsageMB: (memoryUsage / 1024 / 1024).toFixed(2),
        connected: true,
        type: "in-memory",
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return null;
    }
  }

  // Health check
  async healthCheck() {
    try {
      // Simple health check - try to set and get a test value
      const testKey = "health_check_test";
      const testValue = Date.now();

      await this.set(testKey, testValue, 10);
      const retrieved = await this.get(testKey);
      await this.del(testKey);

      if (retrieved === testValue) {
        return { status: "healthy", timestamp: new Date().toISOString() };
      } else {
        return {
          status: "unhealthy",
          error: "Cache read/write test failed",
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Cleanup expired items
  startCleanup() {
    setInterval(() => {
      try {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, item] of this.cache.entries()) {
          if (item.expiresAt && now > item.expiresAt) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach((key) => this.cache.delete(key));

        if (keysToDelete.length > 0) {
          console.log(
            `🧹 Cleaned up ${keysToDelete.length} expired cache items`
          );
        }
      } catch (error) {
        console.error("Cache cleanup error:", error);
      }
    }, this.cleanupInterval);
  }

  // Clear all cache
  async clear() {
    try {
      this.cache.clear();
      console.log("✅ Cache cleared");
      return true;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return false;
    }
  }

  // Close connection (for compatibility)
  async close() {
    try {
      this.cache.clear();
      console.log("✅ In-memory cache service closed");
    } catch (error) {
      console.error("Error closing cache service:", error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
