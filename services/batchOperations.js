const { database } = require('../config/firebase');
const cacheService = require('./cache');

// ✅ NEW: Production-grade batch operations service
class BatchOperationsService {
  constructor() {
    this.batchSize = 500; // Firebase batch limit
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Batch update posts
  async batchUpdatePosts(updates) {
    try {
      const batches = this.chunkArray(Object.entries(updates), this.batchSize);
      const results = [];

      for (const batch of batches) {
        const batchUpdate = {};
        batch.forEach(([path, value]) => {
          batchUpdate[path] = value;
        });

        const result = await this.executeBatchUpdate(batchUpdate);
        results.push(result);
      }

      // Invalidate relevant cache entries
      await this.invalidatePostCaches(updates);

      return {
        success: true,
        batchesProcessed: batches.length,
        totalUpdates: Object.keys(updates).length,
        results
      };
    } catch (error) {
      console.error('Batch update posts error:', error);
      throw error;
    }
  }

  // Batch delete posts
  async batchDeletePosts(postIds) {
    try {
      const batches = this.chunkArray(postIds, this.batchSize);
      const results = [];

      for (const batch of batches) {
        const batchDelete = {};
        batch.forEach(postId => {
          batchDelete[`posts/${postId}`] = null;
        });

        const result = await this.executeBatchUpdate(batchDelete);
        results.push(result);
      }

      // Invalidate cache entries
      await Promise.all(postIds.map(postId => cacheService.invalidatePost(postId)));
      await cacheService.invalidatePosts();

      return {
        success: true,
        batchesProcessed: batches.length,
        totalDeletions: postIds.length,
        results
      };
    } catch (error) {
      console.error('Batch delete posts error:', error);
      throw error;
    }
  }

  // Batch update user data
  async batchUpdateUsers(userUpdates) {
    try {
      const batches = this.chunkArray(Object.entries(userUpdates), this.batchSize);
      const results = [];

      for (const batch of batches) {
        const batchUpdate = {};
        batch.forEach(([userId, userData]) => {
          Object.keys(userData).forEach(key => {
            batchUpdate[`users/${userId}/${key}`] = userData[key];
          });
        });

        const result = await this.executeBatchUpdate(batchUpdate);
        results.push(result);
      }

      // Invalidate user cache entries
      await Promise.all(Object.keys(userUpdates).map(userId => 
        cacheService.invalidateUser(userId)
      ));

      return {
        success: true,
        batchesProcessed: batches.length,
        totalUpdates: Object.keys(userUpdates).length,
        results
      };
    } catch (error) {
      console.error('Batch update users error:', error);
      throw error;
    }
  }

  // Batch update post likes
  async batchUpdateLikes(likeUpdates) {
    try {
      const batches = this.chunkArray(Object.entries(likeUpdates), this.batchSize);
      const results = [];

      for (const batch of batches) {
        const batchUpdate = {};
        batch.forEach(([postId, likeData]) => {
          batchUpdate[`posts/${postId}/likes`] = likeData.likes;
          batchUpdate[`posts/${postId}/likedBy`] = likeData.likedBy;
        });

        const result = await this.executeBatchUpdate(batchUpdate);
        results.push(result);
      }

      // Invalidate post cache entries
      await Promise.all(Object.keys(likeUpdates).map(postId => 
        cacheService.invalidatePost(postId)
      ));

      return {
        success: true,
        batchesProcessed: batches.length,
        totalUpdates: Object.keys(likeUpdates).length,
        results
      };
    } catch (error) {
      console.error('Batch update likes error:', error);
      throw error;
    }
  }

  // Batch update comments
  async batchUpdateComments(commentUpdates) {
    try {
      const batches = this.chunkArray(Object.entries(commentUpdates), this.batchSize);
      const results = [];

      for (const batch of batches) {
        const batchUpdate = {};
        batch.forEach(([commentPath, commentData]) => {
          batchUpdate[commentPath] = commentData;
        });

        const result = await this.executeBatchUpdate(batchUpdate);
        results.push(result);
      }

      // Invalidate comment cache entries
      const postIds = [...new Set(Object.keys(commentUpdates).map(path => 
        path.split('/')[1] // Extract postId from path
      ))];
      await Promise.all(postIds.map(postId => cacheService.invalidateComments(postId)));

      return {
        success: true,
        batchesProcessed: batches.length,
        totalUpdates: Object.keys(commentUpdates).length,
        results
      };
    } catch (error) {
      console.error('Batch update comments error:', error);
      throw error;
    }
  }

  // Execute batch update with retry logic
  async executeBatchUpdate(batchUpdate, retryCount = 0) {
    try {
      await database.ref().update(batchUpdate);
      return { success: true, retryCount };
    } catch (error) {
      if (retryCount < this.maxRetries) {
        console.log(`Batch update failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
        await this.delay(this.retryDelay * (retryCount + 1));
        return await this.executeBatchUpdate(batchUpdate, retryCount + 1);
      } else {
        console.error('Batch update failed after max retries:', error);
        throw error;
      }
    }
  }

  // Chunk array into smaller batches
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // Delay utility
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Invalidate post-related caches
  async invalidatePostCaches(updates) {
    const postIds = new Set();
    
    Object.keys(updates).forEach(path => {
      if (path.startsWith('posts/')) {
        const postId = path.split('/')[1];
        if (postId) {
          postIds.add(postId);
        }
      }
    });

    await Promise.all([
      ...Array.from(postIds).map(postId => cacheService.invalidatePost(postId)),
      cacheService.invalidatePosts()
    ]);
  }

  // Bulk operations for analytics
  async bulkUpdateAnalytics(analyticsData) {
    try {
      const batches = this.chunkArray(Object.entries(analyticsData), this.batchSize);
      const results = [];

      for (const batch of batches) {
        const batchUpdate = {};
        batch.forEach(([path, data]) => {
          batchUpdate[`analytics/${path}`] = data;
        });

        const result = await this.executeBatchUpdate(batchUpdate);
        results.push(result);
      }

      return {
        success: true,
        batchesProcessed: batches.length,
        totalUpdates: Object.keys(analyticsData).length,
        results
      };
    } catch (error) {
      console.error('Bulk update analytics error:', error);
      throw error;
    }
  }

  // Cleanup orphaned data
  async cleanupOrphanedData() {
    try {
      console.log('🧹 Starting orphaned data cleanup...');
      
      // Get all posts
      const postsSnapshot = await database.ref('posts').once('value');
      const posts = postsSnapshot.val() || {};
      
      // Get all users
      const usersSnapshot = await database.ref('users').once('value');
      const users = usersSnapshot.val() || {};
      
      const updates = {};
      let orphanedCount = 0;

      // Find orphaned posts (posts without valid authors)
      Object.entries(posts).forEach(([postId, post]) => {
        if (post.authorId && !users[post.authorId]) {
          console.log(`🗑️ Found orphaned post: ${postId} (author: ${post.authorId})`);
          updates[`posts/${postId}`] = null;
          orphanedCount++;
        }
      });

      // Find orphaned comments
      Object.entries(posts).forEach(([postId, post]) => {
        if (post.comments) {
          Object.entries(post.comments).forEach(([commentId, comment]) => {
            if (comment.authorId && !users[comment.authorId]) {
              console.log(`🗑️ Found orphaned comment: ${commentId} in post: ${postId}`);
              updates[`posts/${postId}/comments/${commentId}`] = null;
              orphanedCount++;
            }
          });
        }
      });

      if (orphanedCount > 0) {
        await this.batchUpdatePosts(updates);
        console.log(`✅ Cleaned up ${orphanedCount} orphaned records`);
      } else {
        console.log('✅ No orphaned data found');
      }

      return {
        success: true,
        orphanedCount,
        cleanedUp: orphanedCount > 0
      };
    } catch (error) {
      console.error('Cleanup orphaned data error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const batchOperationsService = new BatchOperationsService();

module.exports = batchOperationsService;