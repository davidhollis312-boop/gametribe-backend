const { database } = require('../config/firebase');
const cacheService = require('./cache');

// ✅ NEW: Production-grade search service
class SearchService {
  constructor() {
    this.searchIndex = new Map();
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
      'had', 'what', 'said', 'each', 'which', 'their', 'time', 'if',
      'up', 'out', 'many', 'then', 'them', 'can', 'only', 'other',
      'new', 'some', 'could', 'these', 'may', 'say', 'her', 'would',
      'make', 'like', 'into', 'him', 'has', 'two', 'more', 'go', 'no',
      'way', 'could', 'my', 'than', 'first', 'been', 'call', 'who',
      'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get',
      'come', 'made', 'may', 'part'
    ]);
  }

  // Main search function
  async search(query, options = {}) {
    try {
      const {
        type = 'all', // 'posts', 'users', 'comments', 'all'
        page = 1,
        limit = 20,
        sortBy = 'relevance', // 'relevance', 'date', 'popularity'
        filters = {}
      } = options;

      // Check cache first
      const cacheKey = `search:${query}:${type}:${page}:${limit}:${sortBy}:${JSON.stringify(filters)}`;
      const cachedResults = await cacheService.getSearchResults(query, page, limit);
      
      if (cachedResults) {
        return cachedResults;
      }

      // Perform search based on type
      let results = [];
      switch (type) {
        case 'posts':
          results = await this.searchPosts(query, filters);
          break;
        case 'users':
          results = await this.searchUsers(query, filters);
          break;
        case 'comments':
          results = await this.searchComments(query, filters);
          break;
        case 'all':
        default:
          results = await this.searchAll(query, filters);
          break;
      }

      // Sort results
      results = this.sortResults(results, sortBy);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedResults = results.slice(startIndex, endIndex);

      const searchResults = {
        query,
        type,
        results: paginatedResults,
        pagination: {
          page,
          limit,
          total: results.length,
          hasMore: endIndex < results.length,
          totalPages: Math.ceil(results.length / limit)
        },
        filters,
        sortBy,
        timestamp: new Date().toISOString()
      };

      // Cache results
      await cacheService.setSearchResults(query, searchResults, page, limit);

      return searchResults;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  // Search posts
  async searchPosts(query, filters = {}) {
    try {
      const postsSnapshot = await database.ref('posts').once('value');
      const posts = postsSnapshot.val() || {};
      const postsArray = Object.entries(posts).map(([id, data]) => ({ id, ...data }));

      // Filter posts
      let filteredPosts = postsArray.filter(post => {
        // Apply content filters
        if (filters.category && post.category !== filters.category) {
          return false;
        }
        if (filters.authorId && post.authorId !== filters.authorId) {
          return false;
        }
        if (filters.dateFrom && new Date(post.createdAt) < new Date(filters.dateFrom)) {
          return false;
        }
        if (filters.dateTo && new Date(post.createdAt) > new Date(filters.dateTo)) {
          return false;
        }
        if (filters.hasImage && !post.image) {
          return false;
        }
        if (filters.isRepost !== undefined && !!post.isRepost !== filters.isRepost) {
          return false;
        }
        return true;
      });

      // Search in content
      const searchTerms = this.tokenizeQuery(query);
      const scoredPosts = filteredPosts.map(post => {
        const score = this.calculateRelevanceScore(post, searchTerms);
        return { ...post, relevanceScore: score };
      });

      // Filter out posts with zero relevance
      return scoredPosts.filter(post => post.relevanceScore > 0);
    } catch (error) {
      console.error('Search posts error:', error);
      return [];
    }
  }

  // Search users
  async searchUsers(query, filters = {}) {
    try {
      const usersSnapshot = await database.ref('users').once('value');
      const users = usersSnapshot.val() || {};
      const usersArray = Object.entries(users).map(([id, data]) => ({ uid: id, ...data }));

      // Filter users
      let filteredUsers = usersArray.filter(user => {
        if (filters.isActive !== undefined) {
          const lastActive = user.lastActive ? new Date(user.lastActive) : new Date(0);
          const isActive = lastActive > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          if (isActive !== filters.isActive) {
            return false;
          }
        }
        return true;
      });

      // Search in username, displayName, email
      const searchTerms = this.tokenizeQuery(query);
      const scoredUsers = filteredUsers.map(user => {
        const score = this.calculateUserRelevanceScore(user, searchTerms);
        return { ...user, relevanceScore: score };
      });

      return scoredUsers.filter(user => user.relevanceScore > 0);
    } catch (error) {
      console.error('Search users error:', error);
      return [];
    }
  }

  // Search comments
  async searchComments(query, filters = {}) {
    try {
      const postsSnapshot = await database.ref('posts').once('value');
      const posts = postsSnapshot.val() || {};
      const comments = [];

      // Extract comments from all posts
      Object.entries(posts).forEach(([postId, post]) => {
        if (post.comments) {
          Object.entries(post.comments).forEach(([commentId, comment]) => {
            comments.push({
              id: commentId,
              postId,
              postTitle: post.content?.substring(0, 50) + '...',
              ...comment
            });
          });
        }
      });

      // Filter comments
      let filteredComments = comments.filter(comment => {
        if (filters.postId && comment.postId !== filters.postId) {
          return false;
        }
        if (filters.authorId && comment.authorId !== filters.authorId) {
          return false;
        }
        return true;
      });

      // Search in comment content
      const searchTerms = this.tokenizeQuery(query);
      const scoredComments = filteredComments.map(comment => {
        const score = this.calculateRelevanceScore(comment, searchTerms);
        return { ...comment, relevanceScore: score };
      });

      return scoredComments.filter(comment => comment.relevanceScore > 0);
    } catch (error) {
      console.error('Search comments error:', error);
      return [];
    }
  }

  // Search all content types
  async searchAll(query, filters = {}) {
    try {
      const [posts, users, comments] = await Promise.all([
        this.searchPosts(query, filters),
        this.searchUsers(query, filters),
        this.searchComments(query, filters)
      ]);

      // Combine and normalize scores
      const allResults = [
        ...posts.map(post => ({ ...post, type: 'post' })),
        ...users.map(user => ({ ...user, type: 'user' })),
        ...comments.map(comment => ({ ...comment, type: 'comment' }))
      ];

      // Normalize relevance scores across different types
      return this.normalizeScores(allResults);
    } catch (error) {
      console.error('Search all error:', error);
      return [];
    }
  }

  // Tokenize search query
  tokenizeQuery(query) {
    return query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 0 && !this.stopWords.has(term));
  }

  // Calculate relevance score for posts/comments
  calculateRelevanceScore(item, searchTerms) {
    let score = 0;
    const content = (item.content || '').toLowerCase();
    const author = (item.author || '').toLowerCase();
    const category = (item.category || '').toLowerCase();

    searchTerms.forEach(term => {
      // Content matches (highest weight)
      const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
      score += contentMatches * 3;

      // Author matches (medium weight)
      if (author.includes(term)) {
        score += 2;
      }

      // Category matches (low weight)
      if (category.includes(term)) {
        score += 1;
      }

      // Exact phrase matches (bonus)
      if (content.includes(term)) {
        score += 1;
      }
    });

    // Boost score for popular content
    const likes = item.likes || 0;
    const comments = item.comments || 0;
    const reposts = item.repostCount || 0;
    const popularity = likes + comments + reposts;
    score += Math.log(popularity + 1) * 0.1;

    return score;
  }

  // Calculate relevance score for users
  calculateUserRelevanceScore(user, searchTerms) {
    let score = 0;
    const username = (user.username || '').toLowerCase();
    const displayName = (user.displayName || '').toLowerCase();
    const email = (user.email || '').toLowerCase();

    searchTerms.forEach(term => {
      // Username matches (highest weight)
      if (username.includes(term)) {
        score += 3;
      }

      // Display name matches (medium weight)
      if (displayName.includes(term)) {
        score += 2;
      }

      // Email matches (low weight)
      if (email.includes(term)) {
        score += 1;
      }
    });

    return score;
  }

  // Normalize scores across different content types
  normalizeScores(results) {
    if (results.length === 0) return results;

    // Group by type
    const byType = {
      post: results.filter(r => r.type === 'post'),
      user: results.filter(r => r.type === 'user'),
      comment: results.filter(r => r.type === 'comment')
    };

    // Normalize scores within each type
    Object.keys(byType).forEach(type => {
      const typeResults = byType[type];
      if (typeResults.length === 0) return;

      const maxScore = Math.max(...typeResults.map(r => r.relevanceScore));
      const minScore = Math.min(...typeResults.map(r => r.relevanceScore));
      const range = maxScore - minScore;

      if (range > 0) {
        typeResults.forEach(result => {
          result.normalizedScore = (result.relevanceScore - minScore) / range;
        });
      } else {
        typeResults.forEach(result => {
          result.normalizedScore = 0.5;
        });
      }
    });

    // Combine and sort by normalized score
    return results.sort((a, b) => b.normalizedScore - a.normalizedScore);
  }

  // Sort results
  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'date':
        return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      case 'popularity':
        return results.sort((a, b) => {
          const aPopularity = (a.likes || 0) + (a.comments || 0) + (a.repostCount || 0);
          const bPopularity = (b.likes || 0) + (b.comments || 0) + (b.repostCount || 0);
          return bPopularity - aPopularity;
        });
      case 'relevance':
      default:
        return results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }
  }

  // Build search index (for future optimization)
  async buildSearchIndex() {
    try {
      console.log('🔍 Building search index...');
      
      const postsSnapshot = await database.ref('posts').once('value');
      const posts = postsSnapshot.val() || {};
      
      const index = new Map();
      
      Object.entries(posts).forEach(([postId, post]) => {
        const terms = this.tokenizeQuery(post.content || '');
        terms.forEach(term => {
          if (!index.has(term)) {
            index.set(term, []);
          }
          index.get(term).push({
            id: postId,
            type: 'post',
            score: 1
          });
        });
      });

      this.searchIndex = index;
      console.log(`✅ Search index built with ${index.size} terms`);
      
      return { success: true, terms: index.size };
    } catch (error) {
      console.error('Error building search index:', error);
      throw error;
    }
  }

  // Get search suggestions
  async getSearchSuggestions(query, limit = 5) {
    try {
      if (query.length < 2) return [];

      const suggestions = [];
      const searchTerms = this.tokenizeQuery(query);

      // Get suggestions from search index
      searchTerms.forEach(term => {
        if (this.searchIndex.has(term)) {
          const results = this.searchIndex.get(term);
          suggestions.push(...results.slice(0, limit));
        }
      });

      // Remove duplicates and return top suggestions
      const uniqueSuggestions = suggestions
        .filter((suggestion, index, self) => 
          index === self.findIndex(s => s.id === suggestion.id)
        )
        .slice(0, limit);

      return uniqueSuggestions;
    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  // Get trending searches
  async getTrendingSearches(limit = 10) {
    try {
      // This would typically be stored in a separate trending searches collection
      // For now, return mock data
      return [
        'gaming', 'esports', 'tournament', 'streaming', 'reviews',
        'news', 'updates', 'community', 'discussion', 'tips'
      ].slice(0, limit);
    } catch (error) {
      console.error('Error getting trending searches:', error);
      return [];
    }
  }

  // Get search statistics
  getSearchStats() {
    return {
      indexSize: this.searchIndex.size,
      stopWordsCount: this.stopWords.size,
      lastIndexUpdate: new Date().toISOString()
    };
  }
}

// Create singleton instance
const searchService = new SearchService();

module.exports = searchService;