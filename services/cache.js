const Redis = require('ioredis');

// ✅ NEW: Production-grade Redis caching service
class CacheService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('ready', () => {
      console.log('✅ Redis ready for operations');
    });
  }

  // Generic cache operations
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 300) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key) {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Posts-specific caching
  async getPosts(page = 1, limit = 20, category = null, authorId = null) {
    const key = `posts:${page}:${limit}:${category || 'all'}:${authorId || 'all'}`;
    return await this.get(key);
  }

  async setPosts(posts, page = 1, limit = 20, category = null, authorId = null, ttl = 300) {
    const key = `posts:${page}:${limit}:${category || 'all'}:${authorId || 'all'}`;
    return await this.set(key, posts, ttl);
  }

  async invalidatePosts() {
    try {
      const keys = await this.redis.keys('posts:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache invalidation error:', error);
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
  async getAnalytics(type, timeRange = '24h') {
    const key = `analytics:${type}:${timeRange}`;
    return await this.get(key);
  }

  async setAnalytics(type, data, timeRange = '24h', ttl = 3600) {
    const key = `analytics:${type}:${timeRange}`;
    return await this.set(key, data, ttl);
  }

  // Rate limiting
  async incrementRateLimit(key, window = 60) {
    try {
      const current = await this.redis.incr(key);
      if (current === 1) {
        await this.redis.expire(key, window);
      }
      return current;
    } catch (error) {
      console.error('Rate limit increment error:', error);
      return 0;
    }
  }

  async getRateLimit(key) {
    try {
      const current = await this.redis.get(key);
      return current ? parseInt(current) : 0;
    } catch (error) {
      console.error('Rate limit get error:', error);
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
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  // Health check
  async healthCheck() {
    try {
      await this.redis.ping();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  // Close connection
  async close() {
    try {
      await this.redis.quit();
      console.log('✅ Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;