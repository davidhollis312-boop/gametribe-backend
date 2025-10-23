// Add this optimized version of getChallengeHistory
/**
 * Get user's challenge history (OPTIMIZED - No Decryption Bottleneck)
 */
const getChallengeHistoryOptimized = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { limit = 10, offset = 0, status } = req.query;

    console.log(`🔍 OPTIMIZED: Fetching challenges for user: ${userId}`);
    const startTime = Date.now();

    // OPTIMIZATION: Use metadata index instead of decrypting all challenges
    const userChallengesRef = ref(database, `userChallenges/${userId}`);
    const userChallengesSnap = await get(userChallengesRef);

    if (!userChallengesSnap.exists()) {
      return res.json({ success: true, data: [], total: 0, hasMore: false });
    }

    const userChallengeIds = userChallengesSnap.val();
    const challengeIds = Object.keys(userChallengeIds || {});

    console.log(
      `📦 User has ${challengeIds.length} challenges (no decryption needed)`
    );

    // OPTIMIZATION: Only decrypt challenges we need
    const challengesToDecrypt = challengeIds.slice(
      parseInt(offset),
      parseInt(offset) + parseInt(limit)
    );

    const userChallenges = [];
    const uniqueUserIds = new Set();

    // Decrypt only the challenges we need
    for (const challengeId of challengesToDecrypt) {
      try {
        const challengeRef = ref(database, `secureChallenges/${challengeId}`);
        const challengeSnap = await get(challengeRef);

        if (!challengeSnap.exists()) continue;

        const challengeData = decryptData(challengeSnap.val(), ENCRYPTION_KEY);

        // Filter by status if provided
        if (status && challengeData.status !== status) {
          continue;
        }

        // Collect unique user IDs for batch fetching
        uniqueUserIds.add(challengeData.challengerId);
        uniqueUserIds.add(challengeData.challengedId);

        // Store minimal challenge data
        userChallenges.push({
          challengeId: challengeData.challengeId,
          challengerId: challengeData.challengerId,
          challengedId: challengeData.challengedId,
          gameId: challengeData.gameId,
          gameTitle: challengeData.gameTitle,
          gameImage: challengeData.gameImage,
          gameUrl: challengeData.gameUrl,
          betAmount: challengeData.betAmount,
          status: challengeData.status,
          createdAt: challengeData.createdAt,
          completedAt: challengeData.completedAt,
          winnerId: challengeData.winnerId,
          challengerScore: challengeData.challengerScore,
          challengedScore: challengeData.challengedScore,
          isChallenger: challengeData.challengerId === userId,
          opponentId:
            challengeData.challengerId === userId
              ? challengeData.challengedId
              : challengeData.challengerId,
        });
      } catch (decryptError) {
        console.warn(
          `Failed to decrypt challenge ${challengeId}:`,
          decryptError.message
        );
      }
    }

    // Rest of the function remains the same...
    // (user data enrichment, etc.)

    const elapsed = Date.now() - startTime;
    console.log(`⚡ OPTIMIZED Challenge fetch completed in ${elapsed}ms`);

    res.json({
      success: true,
      data: userChallenges,
      total: challengeIds.length,
      hasMore: challengeIds.length > parseInt(offset) + parseInt(limit),
    });
  } catch (error) {
    console.error("Error getting challenge history:", error);
    res.status(500).json({
      error: "Failed to get challenge history",
      message: error.message,
    });
  }
};
