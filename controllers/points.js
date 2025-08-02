const { database } = require("../config/firebase");
const { ref, get, set, update, increment } = require("firebase/database");
const { v4: uuidv4 } = require("uuid");

// Points configuration
const POINTS_CONFIG = {
  POST_DISCUSSION: 3,      // Posting in discussions
  LIKE_POST: 1,            // Liking a post
  COMMENT_POST: 2,         // Commenting on a post
  COMMENT_GAME: 3,         // Commenting on a game
  RATE_GAME: 2,            // Rating a game
  PLAY_GAME: -10,          // Playing a game (deducts points)
  DAILY_LOGIN: 1,          // Daily login bonus
  PROFILE_COMPLETE: 5,     // Complete profile setup
  FIRST_POST: 10,          // First post bonus
  FIRST_COMMENT: 5,        // First comment bonus
  FIRST_LIKE: 2,           // First like bonus
};

// Add points to user
const addPointsToUser = async (userId, points, reason, metadata = {}) => {
  try {
    const userRef = ref(database, `users/${userId}`);
    const pointsHistoryRef = ref(database, `pointsHistory/${userId}`);
    
    // Get current user data
    const userSnapshot = await get(userRef);
    if (!userSnapshot.exists()) {
      throw new Error("User not found");
    }
    
    const userData = userSnapshot.val();
    const currentPoints = userData.points || 0;
    const newPoints = Math.max(0, currentPoints + points); // Ensure points don't go below 0
    
    // Update user points
    await update(userRef, {
      points: newPoints,
      lastPointsUpdate: new Date().toISOString(),
    });
    
    // Record points history
    const historyEntry = {
      id: uuidv4(),
      points: points,
      reason: reason,
      metadata: metadata,
      timestamp: new Date().toISOString(),
      previousPoints: currentPoints,
      newPoints: newPoints,
    };
    
    await set(ref(database, `pointsHistory/${userId}/${historyEntry.id}`), historyEntry);
    
    console.log(`Points updated for user ${userId}: ${points} points for ${reason}`);
    return { success: true, newPoints, pointsAdded: points };
    
  } catch (error) {
    console.error("Error adding points to user:", error);
    throw error;
  }
};

// Get leaderboard data
const getLeaderboard = async (limit = 50, country = null) => {
  try {
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    let users = Object.entries(snapshot.val())
      .map(([uid, userData]) => ({
        uid,
        username: userData.username || "Unknown User",
        avatar: userData.avatar || "https://via.placeholder.com/40",
        points: userData.points || 0,
        country: userData.country || "US",
        createdAt: userData.createdAt,
        lastActive: userData.onlineStatus?.lastActive,
      }))
      .filter(user => user.points > 0); // Only include users with points
    
    // Filter by country if specified
    if (country) {
      users = users.filter(user => user.country === country);
    }
    
    // Sort by points (descending) and then by creation date (newest first)
    users.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Add ranking
    users = users.map((user, index) => ({
      ...user,
      rank: index + 1,
      place: `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"}`,
    }));
    
    return users.slice(0, limit);
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    throw error;
  }
};

// Get user's points history
const getUserPointsHistory = async (userId, limit = 20) => {
  try {
    const historyRef = ref(database, `pointsHistory/${userId}`);
    const snapshot = await get(historyRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const history = Object.values(snapshot.val())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return history;
  } catch (error) {
    console.error("Error getting user points history:", error);
    throw error;
  }
};

// Get user's current rank
const getUserRank = async (userId) => {
  try {
    const leaderboard = await getLeaderboard(1000); // Get all users
    const userIndex = leaderboard.findIndex(user => user.uid === userId);
    
    if (userIndex === -1) {
      return null;
    }
    
    return {
      rank: userIndex + 1,
      totalUsers: leaderboard.length,
      points: leaderboard[userIndex].points,
    };
  } catch (error) {
    console.error("Error getting user rank:", error);
    throw error;
  }
};

// Check if user can perform action (has enough points)
const canPerformAction = async (userId, action) => {
  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const userData = snapshot.val();
    const currentPoints = userData.points || 0;
    const requiredPoints = Math.abs(POINTS_CONFIG[action] || 0);
    
    return currentPoints >= requiredPoints;
  } catch (error) {
    console.error("Error checking if user can perform action:", error);
    return false;
  }
};

// Process points for different actions
const processPointsForAction = async (userId, action, metadata = {}) => {
  try {
    const points = POINTS_CONFIG[action];
    if (points === undefined) {
      throw new Error(`Unknown action: ${action}`);
    }
    
    // For actions that cost points (like playing games), check if user has enough
    if (points < 0) {
      const canPerform = await canPerformAction(userId, action);
      if (!canPerform) {
        throw new Error("Insufficient points for this action");
      }
    }
    
    const result = await addPointsToUser(userId, points, action, metadata);
    return result;
  } catch (error) {
    console.error(`Error processing points for action ${action}:`, error);
    throw error;
  }
};

// Get points statistics
const getPointsStats = async () => {
  try {
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return {
        totalUsers: 0,
        totalPoints: 0,
        averagePoints: 0,
        topUser: null,
      };
    }
    
    const users = Object.values(snapshot.val());
    const usersWithPoints = users.filter(user => (user.points || 0) > 0);
    
    const totalPoints = usersWithPoints.reduce((sum, user) => sum + (user.points || 0), 0);
    const topUser = usersWithPoints.sort((a, b) => (b.points || 0) - (a.points || 0))[0];
    
    return {
      totalUsers: usersWithPoints.length,
      totalPoints,
      averagePoints: usersWithPoints.length > 0 ? Math.round(totalPoints / usersWithPoints.length) : 0,
      topUser: topUser ? {
        username: topUser.username,
        points: topUser.points,
        avatar: topUser.avatar,
      } : null,
    };
  } catch (error) {
    console.error("Error getting points statistics:", error);
    throw error;
  }
};

module.exports = {
  POINTS_CONFIG,
  addPointsToUser,
  getLeaderboard,
  getUserPointsHistory,
  getUserRank,
  canPerformAction,
  processPointsForAction,
  getPointsStats,
}; 