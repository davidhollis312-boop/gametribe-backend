const express = require("express");
const router = express.Router();
const { validateFirebaseToken } = require("../middleware/tokenManager");
const { database } = require("../config/firebase");

// Get games by category
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;

    console.log("🎮 Fetching games with category:", category);

    // For now, return mock challenge games since we don't have a proper games database structure
    // In the future, this should fetch from a proper games collection
    const mockChallengeGames = [
      {
        id: "challenge_game_1",
        title: "Snake Challenge",
        name: "Snake Challenge",
        category: "challenges",
        developer: "Challenge Games Inc",
        imageUrl:
          "https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=300&h=200&fit=crop",
        image:
          "https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=300&h=200&fit=crop",
        demoUrl: "https://example.com/snake-challenge",
        description: "Classic snake game with competitive scoring",
        featured: true,
        exclusive: false,
        createdAt: new Date("2025-08-20T10:00:00.000Z"),
      },
      {
        id: "challenge_game_2",
        title: "Tetris Battle",
        name: "Tetris Battle",
        category: "challenges",
        developer: "Puzzle Challenge Studio",
        imageUrl:
          "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=300&h=200&fit=crop",
        image:
          "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=300&h=200&fit=crop",
        demoUrl: "https://example.com/tetris-battle",
        description: "Fast-paced Tetris with competitive scoring",
        featured: true,
        exclusive: false,
        createdAt: new Date("2025-08-19T15:30:00.000Z"),
      },
      {
        id: "challenge_game_3",
        title: "Memory Challenge",
        name: "Memory Challenge",
        category: "challenges",
        developer: "Brain Challenge Games",
        imageUrl:
          "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=200&fit=crop",
        image:
          "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=200&fit=crop",
        demoUrl: "https://example.com/memory-challenge",
        description: "Test your memory skills in competitive challenges",
        featured: false,
        exclusive: false,
        createdAt: new Date("2025-08-18T14:20:00.000Z"),
      },
      {
        id: "challenge_game_4",
        title: "Word Challenge Battle",
        name: "Word Challenge Battle",
        category: "challenges",
        developer: "Word Challenge Games",
        imageUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop",
        image:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop",
        demoUrl: "https://example.com/word-challenge-demo",
        description: "Battle with words in competitive challenges",
        featured: false,
        exclusive: false,
        createdAt: new Date("2025-08-12T09:15:00.000Z"),
      },
      {
        id: "challenge_game_5",
        title: "Fighting Challenge Tournament",
        name: "Fighting Challenge Tournament",
        category: "challenges",
        developer: "Fight Challenge Ltd",
        imageUrl:
          "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&h=200&fit=crop",
        image:
          "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&h=200&fit=crop",
        demoUrl: "https://example.com/fight-challenge-demo",
        description: "Tournament-style fighting challenges",
        featured: true,
        exclusive: false,
        createdAt: new Date("2025-08-16T11:45:00.000Z"),
      },
      {
        id: "challenge_game_6",
        title: "Adventure Challenge Quest",
        name: "Adventure Challenge Quest",
        category: "challenges",
        developer: "Adventure Challenge Studio",
        imageUrl:
          "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=200&fit=crop",
        image:
          "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=300&h=200&fit=crop",
        demoUrl: "https://example.com/adventure-challenge-demo",
        description: "Complete challenging quests in adventure mode",
        featured: false,
        exclusive: true,
        createdAt: new Date("2025-08-14T16:30:00.000Z"),
      },
    ];

    // Filter by category if specified
    let filteredGames = mockChallengeGames;
    if (category) {
      filteredGames = mockChallengeGames.filter(
        (game) =>
          game.category === category ||
          (category === "challenges" && game.category === "challenges")
      );
    }

    console.log(
      `🎮 Returning ${filteredGames.length} games for category: ${category}`
    );

    res.json({
      success: true,
      games: filteredGames,
      total: filteredGames.length,
    });
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch games",
      games: [],
    });
  }
});

// Get specific game by ID
router.get("/:gameId", async (req, res) => {
  try {
    const { gameId } = req.params;

    console.log("🎮 Fetching game by ID:", gameId);

    // For now, return a mock game - in the future this should fetch from database
    const mockGame = {
      id: gameId,
      title: "Snake Challenge",
      name: "Snake Challenge",
      category: "challenges",
      developer: "Challenge Games Inc",
      imageUrl:
        "https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=300&h=200&fit=crop",
      image:
        "https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=300&h=200&fit=crop",
      demoUrl: "https://example.com/snake-challenge",
      description: "Classic snake game with competitive scoring",
      featured: true,
      exclusive: false,
      createdAt: new Date("2025-08-20T10:00:00.000Z"),
    };

    res.json({
      success: true,
      game: mockGame,
    });
  } catch (error) {
    console.error("Error fetching game:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch game",
    });
  }
});

module.exports = router;
