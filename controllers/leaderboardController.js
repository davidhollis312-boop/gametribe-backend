const { database } = require("../config/firebase");
const {
  ref,
  get,
  query,
  orderByChild,
  limitToFirst,
  startAt,
  endAt,
} = require("firebase/database");

/**
 * Leaderboard Controller
 * Handles leaderboard calculations and data processing on the backend
 */

// Cache for leaderboard data
const leaderboardCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached leaderboard data
 */
const getCachedLeaderboard = (cacheKey) => {
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

/**
 * Set cached leaderboard data
 */
const setCachedLeaderboard = (cacheKey, data) => {
  leaderboardCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  // Clean up old cache entries
  if (leaderboardCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of leaderboardCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        leaderboardCache.delete(key);
      }
    }
  }
};

/**
 * Process and sort leaderboard data
 */
const processLeaderboardData = (data, sortBy = "points", limit = 50) => {
  if (!data || typeof data !== "object") {
    return [];
  }

  const entries = Object.entries(data)
    .map(([userId, userData]) => ({
      userId,
      username: userData.username || userData.displayName || "Unknown",
      points: userData.points || 0,
      country: userData.country || "US",
      avatar: userData.photoURL || userData.avatar || null,
      lastActive: userData.lastActive || null,
      joinDate: userData.createdAt || null,
    }))
    .filter((entry) => entry.points > 0) // Only include users with points
    .sort((a, b) => {
      switch (sortBy) {
        case "points":
          return b.points - a.points;
        case "username":
          return a.username.localeCompare(b.username);
        case "country":
          return a.country.localeCompare(b.country);
        default:
          return b.points - a.points;
      }
    })
    .slice(0, limit);

  // Add rank to each entry
  return entries.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
};

/**
 * Get global leaderboard
 */
const getGlobalLeaderboard = async (req, res) => {
  try {
    const { limit = 50, sortBy = "points", country } = req.query;
    const cacheKey = `global_${limit}_${sortBy}_${country || "all"}`;

    // Check cache first
    const cached = getCachedLeaderboard(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        leaderboard: cached,
        cached: true,
      });
    }

    // Fetch from database
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    const usersData = snapshot.val() || {};

    // Filter by country if specified
    let filteredData = usersData;
    if (country && country !== "all") {
      filteredData = Object.fromEntries(
        Object.entries(usersData).filter(
          ([_, userData]) => userData.country === country
        )
      );
    }

    // Process and sort data
    const leaderboard = processLeaderboardData(
      filteredData,
      sortBy,
      parseInt(limit)
    );

    // Cache the result
    setCachedLeaderboard(cacheKey, leaderboard);

    res.json({
      success: true,
      leaderboard,
      total: leaderboard.length,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching global leaderboard:", error);
    res.status(500).json({
      error: "Failed to fetch global leaderboard",
      message: error.message,
    });
  }
};

/**
 * Get country leaderboard
 */
const getCountryLeaderboard = async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { limit = 50, sortBy = "points" } = req.query;

    if (!countryCode) {
      return res.status(400).json({
        error: "Country code is required",
      });
    }

    const cacheKey = `country_${countryCode}_${limit}_${sortBy}`;

    // Check cache first
    const cached = getCachedLeaderboard(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        leaderboard: cached,
        cached: true,
      });
    }

    // Fetch from database
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    const usersData = snapshot.val() || {};

    // Filter by country
    const filteredData = Object.fromEntries(
      Object.entries(usersData).filter(
        ([_, userData]) => userData.country === countryCode
      )
    );

    // Process and sort data
    const leaderboard = processLeaderboardData(
      filteredData,
      sortBy,
      parseInt(limit)
    );

    // Cache the result
    setCachedLeaderboard(cacheKey, leaderboard);

    res.json({
      success: true,
      leaderboard,
      country: countryCode,
      total: leaderboard.length,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching country leaderboard:", error);
    res.status(500).json({
      error: "Failed to fetch country leaderboard",
      message: error.message,
    });
  }
};

/**
 * Get user's rank
 */
const getUserRank = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { country } = req.query;

    // Fetch user data
    const userRef = ref(database, `users/${userId}`);
    const userSnapshot = await get(userRef);
    const userData = userSnapshot.val();

    if (!userData) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    // Fetch all users
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    const usersData = snapshot.val() || {};

    // Filter by country if specified
    let filteredData = usersData;
    if (country && country !== "all") {
      filteredData = Object.fromEntries(
        Object.entries(usersData).filter(
          ([_, data]) => data.country === country
        )
      );
    }

    // Process and sort data
    const leaderboard = processLeaderboardData(filteredData, "points", 10000);

    // Find user's rank
    const userRank =
      leaderboard.findIndex((entry) => entry.userId === userId) + 1;

    res.json({
      success: true,
      rank: userRank || null,
      total: leaderboard.length,
      points: userData.points || 0,
      country: userData.country || "US",
    });
  } catch (error) {
    console.error("Error fetching user rank:", error);
    res.status(500).json({
      error: "Failed to fetch user rank",
      message: error.message,
    });
  }
};

/**
 * Get user's points history
 */
const getUserPointsHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 20 } = req.query;

    // Fetch user's points history
    const historyRef = ref(database, `users/${userId}/pointsHistory`);
    const snapshot = await get(historyRef);
    const historyData = snapshot.val() || {};

    // Convert to array and sort by timestamp
    const history = Object.entries(historyData)
      .map(([timestamp, entry]) => ({
        timestamp: parseInt(timestamp),
        points: entry.points || 0,
        action: entry.action || "unknown",
        metadata: entry.metadata || {},
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      history,
      total: history.length,
    });
  } catch (error) {
    console.error("Error fetching points history:", error);
    res.status(500).json({
      error: "Failed to fetch points history",
      message: error.message,
    });
  }
};

/**
 * Get points statistics
 */
const getPointsStats = async (req, res) => {
  try {
    const cacheKey = "points_stats";

    // Check cache first
    const cached = getCachedLeaderboard(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        stats: cached,
        cached: true,
      });
    }

    // Fetch all users
    const usersRef = ref(database, "users");
    const snapshot = await get(usersRef);
    const usersData = snapshot.val() || {};

    // Calculate statistics
    const users = Object.values(usersData);
    const totalUsers = users.length;
    const usersWithPoints = users.filter((user) => (user.points || 0) > 0);
    const totalPoints = users.reduce(
      (sum, user) => sum + (user.points || 0),
      0
    );
    const averagePoints =
      totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;

    // Top countries by points
    const countryStats = {};
    users.forEach((user) => {
      const country = user.country || "Unknown";
      if (!countryStats[country]) {
        countryStats[country] = { totalPoints: 0, userCount: 0 };
      }
      countryStats[country].totalPoints += user.points || 0;
      countryStats[country].userCount += 1;
    });

    const topCountries = Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        totalPoints: stats.totalPoints,
        userCount: stats.userCount,
        averagePoints: Math.round(stats.totalPoints / stats.userCount),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 10);

    const stats = {
      totalUsers,
      usersWithPoints: usersWithPoints.length,
      totalPoints,
      averagePoints,
      topCountries,
    };

    // Cache the result
    setCachedLeaderboard(cacheKey, stats);

    res.json({
      success: true,
      stats,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching points statistics:", error);
    res.status(500).json({
      error: "Failed to fetch points statistics",
      message: error.message,
    });
  }
};

/**
 * Get clan leaderboard
 */
const getClanLeaderboard = async (req, res) => {
  try {
    const { clanId } = req.params;
    const { limit = 50, sortBy = "points" } = req.query;

    if (!clanId) {
      return res.status(400).json({
        error: "Clan ID is required",
      });
    }

    const cacheKey = `clan_${clanId}_${limit}_${sortBy}`;

    // Check cache first
    const cached = getCachedLeaderboard(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        leaderboard: cached,
        cached: true,
      });
    }

    // Fetch clan data
    const clanRef = ref(database, `clans/${clanId}`);
    const clanSnapshot = await get(clanRef);
    const clanData = clanSnapshot.val();

    if (!clanData) {
      return res.status(404).json({
        error: "Clan not found",
      });
    }

    // Fetch clan members
    const members = clanData.members || {};
    const memberIds = Object.keys(members);

    if (memberIds.length === 0) {
      return res.json({
        success: true,
        leaderboard: [],
        total: 0,
        cached: false,
      });
    }

    // Fetch member data
    const memberData = {};
    for (const memberId of memberIds) {
      const memberRef = ref(database, `users/${memberId}`);
      const memberSnapshot = await get(memberRef);
      const userData = memberSnapshot.val();
      if (userData) {
        memberData[memberId] = userData;
      }
    }

    // Process and sort data
    const leaderboard = processLeaderboardData(
      memberData,
      sortBy,
      parseInt(limit)
    );

    // Cache the result
    setCachedLeaderboard(cacheKey, leaderboard);

    res.json({
      success: true,
      leaderboard,
      clanId,
      total: leaderboard.length,
      cached: false,
    });
  } catch (error) {
    console.error("Error fetching clan leaderboard:", error);
    res.status(500).json({
      error: "Failed to fetch clan leaderboard",
      message: error.message,
    });
  }
};

/**
 * Clear leaderboard cache
 */
const clearLeaderboardCache = async (req, res) => {
  try {
    leaderboardCache.clear();
    res.json({
      success: true,
      message: "Leaderboard cache cleared",
    });
  } catch (error) {
    console.error("Error clearing leaderboard cache:", error);
    res.status(500).json({
      error: "Failed to clear cache",
      message: error.message,
    });
  }
};

module.exports = {
  getGlobalLeaderboard,
  getCountryLeaderboard,
  getUserRank,
  getUserPointsHistory,
  getPointsStats,
  getClanLeaderboard,
  clearLeaderboardCache,
  processLeaderboardData,
};
