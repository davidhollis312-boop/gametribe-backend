const axios = require('axios');

// ✅ NEW: Production-grade content moderation service
class ContentModerationService {
  constructor() {
    this.inappropriateWords = [
      // Basic inappropriate words
      'spam', 'scam', 'fake', 'hate', 'abuse', 'harassment',
      'discrimination', 'violence', 'illegal', 'fraud', 'phishing',
      'malware', 'virus', 'hack', 'exploit', 'cheat', 'bot',
      
      // Gaming-related inappropriate terms
      'hacker', 'cheater', 'noob', 'trash', 'garbage', 'suck',
      'kill yourself', 'kys', 'uninstall', 'delete game',
      
      // General inappropriate content
      'nsfw', 'porn', 'sexual', 'explicit', 'adult', 'xxx',
      'drugs', 'alcohol', 'smoking', 'cigarette', 'marijuana',
      
      // Spam patterns
      'click here', 'free money', 'earn cash', 'work from home',
      'make money fast', 'get rich quick', 'crypto investment',
      'bitcoin', 'cryptocurrency', 'investment opportunity'
    ];

    this.spamPatterns = [
      /(.)\1{4,}/g, // Repeated characters (e.g., "aaaaa")
      /(https?:\/\/[^\s]+){3,}/g, // Multiple URLs
      /(@\w+\s*){5,}/g, // Multiple mentions
      /(#\w+\s*){10,}/g, // Excessive hashtags
      /(free|win|click|here|now)\s*!{3,}/gi, // Spam keywords with exclamation marks
    ];

    this.suspiciousPatterns = [
      /[A-Z]{10,}/g, // Excessive caps
      /[!]{3,}/g, // Multiple exclamation marks
      /[?]{3,}/g, // Multiple question marks
      /[.]{3,}/g, // Multiple periods
    ];

    // AI moderation service (if available)
    this.aiModerationEnabled = process.env.AI_MODERATION_ENABLED === 'true';
    this.aiModerationEndpoint = process.env.AI_MODERATION_ENDPOINT;
    this.aiModerationApiKey = process.env.AI_MODERATION_API_KEY;
  }

  // Main moderation function
  async moderateContent(content, contentType = 'post', userId = null) {
    try {
      const results = {
        isApproved: true,
        confidence: 1.0,
        flags: [],
        reasons: [],
        suggestions: [],
        severity: 'low'
      };

      // Basic text analysis
      const textAnalysis = this.analyzeText(content);
      results.flags.push(...textAnalysis.flags);
      results.reasons.push(...textAnalysis.reasons);

      // Spam detection
      const spamAnalysis = this.detectSpam(content);
      if (spamAnalysis.isSpam) {
        results.isApproved = false;
        results.severity = 'high';
        results.flags.push('spam');
        results.reasons.push('Content appears to be spam');
      }

      // Inappropriate content detection
      const inappropriateAnalysis = this.detectInappropriateContent(content);
      if (inappropriateAnalysis.isInappropriate) {
        results.isApproved = false;
        results.severity = 'high';
        results.flags.push('inappropriate');
        results.reasons.push('Content contains inappropriate material');
      }

      // AI moderation (if enabled)
      if (this.aiModerationEnabled) {
        const aiAnalysis = await this.aiModerateContent(content);
        if (aiAnalysis) {
          results.flags.push(...aiAnalysis.flags);
          results.reasons.push(...aiAnalysis.reasons);
          results.confidence = Math.min(results.confidence, aiAnalysis.confidence);
          
          if (aiAnalysis.severity === 'high') {
            results.isApproved = false;
            results.severity = 'high';
          }
        }
      }

      // User-specific moderation
      if (userId) {
        const userAnalysis = await this.analyzeUserBehavior(userId);
        if (userAnalysis.isSuspicious) {
          results.confidence *= 0.5; // Reduce confidence for suspicious users
          results.flags.push('suspicious_user');
        }
      }

      // Content type specific moderation
      const typeSpecificAnalysis = this.analyzeContentType(content, contentType);
      results.flags.push(...typeSpecificAnalysis.flags);
      results.reasons.push(...typeSpecificAnalysis.reasons);

      // Final decision
      if (results.flags.length > 0) {
        results.confidence = Math.max(0, results.confidence - (results.flags.length * 0.1));
      }

      if (results.confidence < 0.5) {
        results.isApproved = false;
        results.severity = 'medium';
      }

      return results;
    } catch (error) {
      console.error('Content moderation error:', error);
      // Fail safe - approve content if moderation fails
      return {
        isApproved: true,
        confidence: 0.5,
        flags: ['moderation_error'],
        reasons: ['Content moderation service unavailable'],
        severity: 'low'
      };
    }
  }

  // Analyze text for basic issues
  analyzeText(content) {
    const flags = [];
    const reasons = [];

    // Check for excessive length
    if (content.length > 2000) {
      flags.push('excessive_length');
      reasons.push('Content exceeds maximum length');
    }

    // Check for minimal content
    if (content.trim().length < 3) {
      flags.push('minimal_content');
      reasons.push('Content is too short');
    }

    // Check for suspicious patterns
    this.suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        flags.push(`suspicious_pattern_${index}`);
        reasons.push('Content contains suspicious patterns');
      }
    });

    return { flags, reasons };
  }

  // Detect spam content
  detectSpam(content) {
    const lowerContent = content.toLowerCase();
    
    console.log('🔍 SPAM DETECTION DEBUG:', {
      content: content,
      lowerContent: lowerContent,
      contentLength: content.length
    });
    
    // Check spam patterns
    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        console.log('❌ SPAM PATTERN MATCHED:', {
          pattern: pattern.toString(),
          content: content
        });
        return { isSpam: true, pattern: pattern.toString() };
      }
    }

    // Check for excessive repetition (only for longer content)
    if (content.length > 50) {
      const words = lowerContent.split(/\s+/);
      const wordCounts = {};
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });

      const maxRepetition = Math.max(...Object.values(wordCounts));
      if (maxRepetition > words.length * 0.3) {
        return { isSpam: true, reason: 'excessive_word_repetition' };
      }
    }

    // Check for URL spam
    const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    if (urlCount > 3) {
      return { isSpam: true, reason: 'excessive_urls' };
    }

    return { isSpam: false };
  }

  // Detect inappropriate content
  detectInappropriateContent(content) {
    const lowerContent = content.toLowerCase();
    
    console.log('🔍 INAPPROPRIATE CONTENT DEBUG:', {
      content: content,
      lowerContent: lowerContent
    });
    
    for (const word of this.inappropriateWords) {
      if (lowerContent.includes(word.toLowerCase())) {
        console.log('❌ INAPPROPRIATE WORD MATCHED:', {
          word: word,
          content: content
        });
        return { 
          isInappropriate: true, 
          flaggedWord: word,
          severity: this.getWordSeverity(word)
        };
      }
    }

    return { isInappropriate: false };
  }

  // Get severity level for flagged words
  getWordSeverity(word) {
    const highSeverityWords = ['hate', 'abuse', 'harassment', 'violence', 'illegal'];
    const mediumSeverityWords = ['spam', 'scam', 'fake', 'discrimination'];
    
    if (highSeverityWords.includes(word.toLowerCase())) {
      return 'high';
    } else if (mediumSeverityWords.includes(word.toLowerCase())) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // AI-powered content moderation
  async aiModerateContent(content) {
    if (!this.aiModerationEnabled || !this.aiModerationEndpoint) {
      return null;
    }

    try {
      const response = await axios.post(this.aiModerationEndpoint, {
        text: content,
        api_key: this.aiModerationApiKey
      }, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        return {
          flags: response.data.flags || [],
          reasons: response.data.reasons || [],
          confidence: response.data.confidence || 0.8,
          severity: response.data.severity || 'low'
        };
      }
    } catch (error) {
      console.error('AI moderation error:', error);
    }

    return null;
  }

  // Analyze user behavior for suspicious activity
  async analyzeUserBehavior(userId) {
    try {
      // This would typically query user activity data
      // For now, return a basic analysis
      return {
        isSuspicious: false,
        riskScore: 0.1,
        flags: []
      };
    } catch (error) {
      console.error('User behavior analysis error:', error);
      return { isSuspicious: false, riskScore: 0.1, flags: [] };
    }
  }

  // Content type specific analysis
  analyzeContentType(content, contentType) {
    const flags = [];
    const reasons = [];

    switch (contentType) {
      case 'post':
        // Posts should have meaningful content (but allow short posts with media)
        if (content.length < 5) {
          flags.push('minimal_post_content');
          reasons.push('Post content is too short');
        }
        break;
      
      case 'comment':
        // Comments can be shorter
        if (content.length < 3) {
          flags.push('minimal_comment_content');
          reasons.push('Comment is too short');
        }
        break;
      
      case 'reply':
        // Replies can be very short
        if (content.length < 1) {
          flags.push('empty_reply');
          reasons.push('Reply is empty');
        }
        break;
    }

    return { flags, reasons };
  }

  // Moderate image content (placeholder for future implementation)
  async moderateImage(imageUrl) {
    try {
      // This would typically use an image moderation API
      // For now, return a basic analysis
      return {
        isApproved: true,
        confidence: 0.9,
        flags: [],
        reasons: [],
        severity: 'low'
      };
    } catch (error) {
      console.error('Image moderation error:', error);
      return {
        isApproved: true,
        confidence: 0.5,
        flags: ['moderation_error'],
        reasons: ['Image moderation service unavailable'],
        severity: 'low'
      };
    }
  }

  // Get moderation statistics
  getModerationStats() {
    return {
      inappropriateWordsCount: this.inappropriateWords.length,
      spamPatternsCount: this.spamPatterns.length,
      suspiciousPatternsCount: this.suspiciousPatterns.length,
      aiModerationEnabled: this.aiModerationEnabled
    };
  }

  // Update inappropriate words list
  updateInappropriateWords(newWords) {
    this.inappropriateWords = [...new Set([...this.inappropriateWords, ...newWords])];
  }

  // Remove words from inappropriate list
  removeInappropriateWords(wordsToRemove) {
    this.inappropriateWords = this.inappropriateWords.filter(
      word => !wordsToRemove.includes(word)
    );
  }
}

// Create singleton instance
const contentModerationService = new ContentModerationService();

module.exports = contentModerationService;