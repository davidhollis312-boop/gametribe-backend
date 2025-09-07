const prometheus = require('prom-client');
const Sentry = require('@sentry/node');
const { database } = require('../config/firebase');
const cacheService = require('./cache');

// ✅ NEW: Production-grade monitoring and analytics service
class MonitoringService {
  constructor() {
    this.initializePrometheus();
    // Initialize Sentry only if DSN is provided
    if (process.env.SENTRY_DSN) {
      this.initializeSentry();
    }
    this.initializeCustomMetrics();
  }

  // Initialize Prometheus metrics
  initializePrometheus() {
    // Reset metrics registry
    prometheus.register.clear();

    // HTTP request metrics
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.httpRequestTotal = new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });

    // Post-related metrics
    this.postsCreated = new prometheus.Counter({
      name: 'posts_created_total',
      help: 'Total number of posts created',
      labelNames: ['category', 'user_type']
    });

    this.postsDeleted = new prometheus.Counter({
      name: 'posts_deleted_total',
      help: 'Total number of posts deleted',
      labelNames: ['reason']
    });

    this.postsLiked = new prometheus.Counter({
      name: 'posts_liked_total',
      help: 'Total number of post likes',
      labelNames: ['action'] // 'like' or 'unlike'
    });

    this.postsReposted = new prometheus.Counter({
      name: 'posts_reposted_total',
      help: 'Total number of post reposts'
    });

    // Comment metrics
    this.commentsCreated = new prometheus.Counter({
      name: 'comments_created_total',
      help: 'Total number of comments created',
      labelNames: ['post_type']
    });

    // User metrics
    this.usersActive = new prometheus.Gauge({
      name: 'users_active_total',
      help: 'Number of active users'
    });

    this.usersRegistered = new prometheus.Counter({
      name: 'users_registered_total',
      help: 'Total number of user registrations'
    });

    // Database metrics
    this.databaseOperations = new prometheus.Counter({
      name: 'database_operations_total',
      help: 'Total number of database operations',
      labelNames: ['operation', 'table']
    });

    this.databaseOperationDuration = new prometheus.Histogram({
      name: 'database_operation_duration_seconds',
      help: 'Duration of database operations in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
    });

    // Cache metrics
    this.cacheHits = new prometheus.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type']
    });

    this.cacheMisses = new prometheus.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type']
    });

    // Error metrics
    this.errorsTotal = new prometheus.Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'severity']
    });

    // Rate limiting metrics
    this.rateLimitHits = new prometheus.Counter({
      name: 'rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['endpoint', 'limit_type']
    });

    // Content moderation metrics
    this.contentModerated = new prometheus.Counter({
      name: 'content_moderated_total',
      help: 'Total number of content moderation checks',
      labelNames: ['content_type', 'result']
    });

    this.contentFlagged = new prometheus.Counter({
      name: 'content_flagged_total',
      help: 'Total number of flagged content',
      labelNames: ['flag_type', 'severity']
    });

    // System metrics
    this.systemMemoryUsage = new prometheus.Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes'
    });

    this.systemCpuUsage = new prometheus.Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage'
    });
  }

  // Initialize Sentry for error tracking
  initializeSentry() {
    if (process.env.SENTRY_DSN) {
      try {
        Sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV || 'development',
          tracesSampleRate: 0.1,
          // Simplified integration setup for newer Sentry versions
          integrations: [
            // Http integration is now included by default in newer versions
            // Express integration is also included by default
          ],
        });
        console.log('✅ Sentry initialized successfully');
      } catch (error) {
        console.warn('⚠️ Sentry initialization failed:', error.message);
        // Continue without Sentry if initialization fails
      }
    } else {
      console.log('ℹ️ Sentry DSN not provided, skipping Sentry initialization');
    }
  }

  // Initialize custom metrics
  initializeCustomMetrics() {
    // Start system metrics collection
    this.startSystemMetricsCollection();
    
    // Start user activity tracking
    this.startUserActivityTracking();
  }

  // Track HTTP requests
  trackHttpRequest(method, route, statusCode, duration) {
    this.httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);
    
    this.httpRequestTotal
      .labels(method, route, statusCode)
      .inc();
  }

  // Track post creation
  trackPostCreated(category, userType) {
    this.postsCreated
      .labels(category || 'uncategorized', userType || 'regular')
      .inc();
  }

  // Track post deletion
  trackPostDeleted(reason) {
    this.postsDeleted
      .labels(reason || 'user_request')
      .inc();
  }

  // Track post likes
  trackPostLiked(action) {
    this.postsLiked
      .labels(action)
      .inc();
  }

  // Track post reposts
  trackPostReposted() {
    this.postsReposted.inc();
  }

  // Track comment creation
  trackCommentCreated(postType) {
    this.commentsCreated
      .labels(postType || 'regular')
      .inc();
  }

  // Track user registration
  trackUserRegistered() {
    this.usersRegistered.inc();
  }

  // Track database operations
  trackDatabaseOperation(operation, table, duration) {
    this.databaseOperations
      .labels(operation, table)
      .inc();
    
    if (duration !== undefined) {
      this.databaseOperationDuration
        .labels(operation, table)
        .observe(duration);
    }
  }

  // Track cache operations
  trackCacheHit(cacheType) {
    this.cacheHits
      .labels(cacheType)
      .inc();
  }

  trackCacheMiss(cacheType) {
    this.cacheMisses
      .labels(cacheType)
      .inc();
  }

  // Track errors
  trackError(errorType, severity = 'medium') {
    this.errorsTotal
      .labels(errorType, severity)
      .inc();
    
    // Send to Sentry if configured
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(new Error(errorType));
    }
  }

  // Track rate limiting
  trackRateLimitHit(endpoint, limitType) {
    this.rateLimitHits
      .labels(endpoint, limitType)
      .inc();
  }

  // Track content moderation
  trackContentModerated(contentType, result) {
    this.contentModerated
      .labels(contentType, result)
      .inc();
  }

  // Track flagged content
  trackContentFlagged(flagType, severity) {
    this.contentFlagged
      .labels(flagType, severity)
      .inc();
  }

  // Start system metrics collection
  startSystemMetricsCollection() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.systemMemoryUsage.set(memUsage.heapUsed);
      
      // CPU usage would require additional library like 'pidusage'
      // this.systemCpuUsage.set(cpuUsage.percentage);
    }, 30000); // Every 30 seconds
  }

  // Start user activity tracking
  startUserActivityTracking() {
    setInterval(async () => {
      try {
        // Count active users (users with recent activity)
        const activeUsersSnapshot = await database.ref('users')
          .orderByChild('lastActive')
          .startAt(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          .once('value');
        
        const activeUsers = activeUsersSnapshot.numChildren();
        this.usersActive.set(activeUsers);
      } catch (error) {
        console.error('Error tracking user activity:', error);
      }
    }, 60000); // Every minute
  }

  // Get metrics for Prometheus scraping
  getMetrics() {
    return prometheus.register.metrics();
  }

  // Get custom analytics data
  async getAnalytics(timeRange = '24h') {
    try {
      const now = Date.now();
      const timeRanges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const range = timeRanges[timeRange] || timeRanges['24h'];
      const startTime = now - range;

      // Get posts created in time range
      const postsSnapshot = await database.ref('posts')
        .orderByChild('createdAt')
        .startAt(new Date(startTime).toISOString())
        .once('value');
      
      const posts = postsSnapshot.val() || {};
      const postsArray = Object.values(posts);

      // Get users registered in time range
      const usersSnapshot = await database.ref('users')
        .orderByChild('createdAt')
        .startAt(new Date(startTime).toISOString())
        .once('value');
      
      const users = usersSnapshot.val() || {};
      const usersArray = Object.values(users);

      // Calculate analytics
      const analytics = {
        timeRange,
        posts: {
          total: postsArray.length,
          byCategory: this.groupBy(postsArray, 'category'),
          byHour: this.groupByHour(postsArray, 'createdAt')
        },
        users: {
          total: usersArray.length,
          byHour: this.groupByHour(usersArray, 'createdAt')
        },
        engagement: {
          totalLikes: postsArray.reduce((sum, post) => sum + (post.likes || 0), 0),
          totalComments: postsArray.reduce((sum, post) => sum + (post.comments || 0), 0),
          totalReposts: postsArray.reduce((sum, post) => sum + (post.repostCount || 0), 0)
        },
        topPosts: this.getTopPosts(postsArray, 10),
        topUsers: this.getTopUsers(usersArray, postsArray, 10)
      };

      return analytics;
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  // Helper function to group data by field
  groupBy(array, field) {
    return array.reduce((groups, item) => {
      const key = item[field] || 'uncategorized';
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  // Helper function to group data by hour
  groupByHour(array, dateField) {
    return array.reduce((groups, item) => {
      const date = new Date(item[dateField]);
      const hour = date.getHours();
      groups[hour] = (groups[hour] || 0) + 1;
      return groups;
    }, {});
  }

  // Get top posts by engagement
  getTopPosts(posts, limit = 10) {
    return posts
      .sort((a, b) => {
        const aEngagement = (a.likes || 0) + (a.comments || 0) + (a.repostCount || 0);
        const bEngagement = (b.likes || 0) + (b.comments || 0) + (b.repostCount || 0);
        return bEngagement - aEngagement;
      })
      .slice(0, limit)
      .map(post => ({
        id: post.id,
        author: post.author,
        content: post.content.substring(0, 100) + '...',
        likes: post.likes || 0,
        comments: post.comments || 0,
        reposts: post.repostCount || 0,
        createdAt: post.createdAt
      }));
  }

  // Get top users by activity
  getTopUsers(users, posts, limit = 10) {
    const userActivity = {};
    
    // Count posts per user
    posts.forEach(post => {
      if (post.authorId) {
        userActivity[post.authorId] = {
          ...userActivity[post.authorId],
          posts: (userActivity[post.authorId]?.posts || 0) + 1,
          likes: (userActivity[post.authorId]?.likes || 0) + (post.likes || 0),
          comments: (userActivity[post.authorId]?.comments || 0) + (post.comments || 0),
          reposts: (userActivity[post.authorId]?.reposts || 0) + (post.repostCount || 0)
        };
      }
    });

    return Object.entries(userActivity)
      .sort(([,a], [,b]) => {
        const aTotal = a.posts + a.likes + a.comments + a.reposts;
        const bTotal = b.posts + b.likes + b.comments + b.reposts;
        return bTotal - aTotal;
      })
      .slice(0, limit)
      .map(([userId, activity]) => ({
        userId,
        username: users.find(u => u.uid === userId)?.username || 'Unknown',
        ...activity
      }));
  }

  // Health check
  async healthCheck() {
    try {
      const checks = {
        database: await this.checkDatabaseHealth(),
        cache: await this.checkCacheHealth(),
        memory: this.checkMemoryHealth(),
        timestamp: new Date().toISOString()
      };

      const isHealthy = Object.values(checks).every(check => 
        typeof check === 'object' ? check.status === 'healthy' : check === true
      );

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        checks
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Check database health
  async checkDatabaseHealth() {
    try {
      await database.ref('health').set({ timestamp: Date.now() });
      await database.ref('health').remove();
      return { status: 'healthy', responseTime: Date.now() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Check cache health
  async checkCacheHealth() {
    try {
      return await cacheService.healthCheck();
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  // Check memory health
  checkMemoryHealth() {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    const isHealthy = memUsageMB < 500; // Less than 500MB
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      memoryUsageMB: memUsageMB,
      threshold: 500
    };
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;