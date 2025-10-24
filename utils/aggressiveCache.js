const NodeCache = require("node-cache");

// Create multiple cache instances for different data types
const challengeCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  maxKeys: 1000,
  useClones: false, // Better performance
});

const userCache = new NodeCache({
  stdTTL: 600, // 10 minutes
  maxKeys: 500,
  useClones: false,
});

const challengeIndexCache = new NodeCache({
  stdTTL: 180, // 3 minutes
  maxKeys: 2000,
  useClones: false,
});

/**
 * Get cached challenge data
 * @param {string} challengeId - Challenge ID
 * @returns {object|null} - Cached challenge data or null
 */
function getCachedChallenge(challengeId) {
  try {
    const cached = challengeCache.get(challengeId);
    if (cached) {
      console.log(`📦 Cache HIT for challenge: ${challengeId}`);
      return cached;
    }
    console.log(`📦 Cache MISS for challenge: ${challengeId}`);
    return null;
  } catch (error) {
    console.error("Error getting cached challenge:", error);
    return null;
  }
}

/**
 * Cache challenge data
 * @param {string} challengeId - Challenge ID
 * @param {object} challengeData - Challenge data to cache
 */
function setCachedChallenge(challengeId, challengeData) {
  try {
    challengeCache.set(challengeId, challengeData);
    console.log(`📦 Cached challenge: ${challengeId}`);
  } catch (error) {
    console.error("Error caching challenge:", error);
  }
}

/**
 * Get cached user data
 * @param {string} userId - User ID
 * @returns {object|null} - Cached user data or null
 */
function getCachedUser(userId) {
  try {
    const cached = userCache.get(userId);
    if (cached) {
      console.log(`👤 Cache HIT for user: ${userId}`);
      return cached;
    }
    console.log(`👤 Cache MISS for user: ${userId}`);
    return null;
  } catch (error) {
    console.error("Error getting cached user:", error);
    return null;
  }
}

/**
 * Cache user data
 * @param {string} userId - User ID
 * @param {object} userData - User data to cache
 */
function setCachedUser(userId, userData) {
  try {
    userCache.set(userId, userData);
    console.log(`👤 Cached user: ${userId}`);
  } catch (error) {
    console.error("Error caching user:", error);
  }
}

/**
 * Get cached challenge index
 * @param {string} userId - User ID
 * @param {string} status - Challenge status
 * @returns {array|null} - Cached challenge IDs or null
 */
function getCachedChallengeIndex(userId, status) {
  try {
    const key = `${userId}_${status || "all"}`;
    const cached = challengeIndexCache.get(key);
    if (cached) {
      console.log(`📋 Cache HIT for challenge index: ${key}`);
      return cached;
    }
    console.log(`📋 Cache MISS for challenge index: ${key}`);
    return null;
  } catch (error) {
    console.error("Error getting cached challenge index:", error);
    return null;
  }
}

/**
 * Cache challenge index
 * @param {string} userId - User ID
 * @param {string} status - Challenge status
 * @param {array} challengeIds - Challenge IDs to cache
 */
function setCachedChallengeIndex(userId, status, challengeIds) {
  try {
    const key = `${userId}_${status || "all"}`;
    challengeIndexCache.set(key, challengeIds);
    console.log(
      `📋 Cached challenge index: ${key} (${challengeIds.length} items)`
    );
  } catch (error) {
    console.error("Error caching challenge index:", error);
  }
}

/**
 * Invalidate challenge cache
 * @param {string} challengeId - Challenge ID to invalidate
 */
function invalidateChallenge(challengeId) {
  try {
    challengeCache.del(challengeId);
    console.log(`🗑️ Invalidated challenge cache: ${challengeId}`);
  } catch (error) {
    console.error("Error invalidating challenge cache:", error);
  }
}

/**
 * Invalidate user cache
 * @param {string} userId - User ID to invalidate
 */
function invalidateUser(userId) {
  try {
    userCache.del(userId);
    console.log(`🗑️ Invalidated user cache: ${userId}`);
  } catch (error) {
    console.error("Error invalidating user cache:", error);
  }
}

/**
 * Invalidate all challenge indexes for a user
 * @param {string} userId - User ID
 */
function invalidateUserChallengeIndexes(userId) {
  try {
    const keys = challengeIndexCache.keys();
    const userKeys = keys.filter((key) => key.startsWith(`${userId}_`));
    userKeys.forEach((key) => challengeIndexCache.del(key));
    console.log(
      `🗑️ Invalidated ${userKeys.length} challenge indexes for user: ${userId}`
    );
  } catch (error) {
    console.error("Error invalidating user challenge indexes:", error);
  }
}

/**
 * Get cache statistics
 * @returns {object} - Cache statistics
 */
function getCacheStats() {
  return {
    challenges: {
      keys: challengeCache.keys().length,
      hits: challengeCache.getStats().hits,
      misses: challengeCache.getStats().misses,
    },
    users: {
      keys: userCache.keys().length,
      hits: userCache.getStats().hits,
      misses: userCache.getStats().misses,
    },
    challengeIndexes: {
      keys: challengeIndexCache.keys().length,
      hits: challengeIndexCache.getStats().hits,
      misses: challengeIndexCache.getStats().misses,
    },
  };
}

/**
 * Clear all caches
 */
function clearAllCaches() {
  try {
    challengeCache.flushAll();
    userCache.flushAll();
    challengeIndexCache.flushAll();
    console.log("🧹 Cleared all caches");
  } catch (error) {
    console.error("Error clearing caches:", error);
  }
}

module.exports = {
  getCachedChallenge,
  setCachedChallenge,
  getCachedUser,
  setCachedUser,
  getCachedChallengeIndex,
  setCachedChallengeIndex,
  invalidateChallenge,
  invalidateUser,
  invalidateUserChallengeIndexes,
  getCacheStats,
  clearAllCaches,
};
