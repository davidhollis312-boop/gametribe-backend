const axios = require("axios");
const cheerio = require("cheerio");
const { validateUrl, extractUrls } = require("./contentSanitizer");

/**
 * URL Validation and Open Graph Middleware
 * Handles URL validation, Open Graph data fetching, and link previews
 */

// Allowed domains for Open Graph fetching
const ALLOWED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "github.com",
  "stackoverflow.com",
  "reddit.com",
  "medium.com",
  "dev.to",
  "hashnode.com",
  "gametribe.com",
  "hub.gametribe.com",
];

// Blocked domains for security
const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "file://",
  "ftp://",
  "javascript:",
  "data:",
  "vbscript:",
  "onload=",
  "onerror=",
  "onclick=",
];

/**
 * Enhanced URL validation
 */
const validateUrlEnhanced = (url) => {
  try {
    const urlObj = new URL(url);

    // Check protocol
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return { valid: false, reason: "Invalid protocol" };
    }

    // Check for blocked domains
    const hostname = urlObj.hostname.toLowerCase();
    if (BLOCKED_DOMAINS.some((blocked) => hostname.includes(blocked))) {
      return { valid: false, reason: "Blocked domain" };
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /eval\(/i,
      /expression\(/i,
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      return { valid: false, reason: "Suspicious content" };
    }

    // Check URL length
    if (url.length > 2048) {
      return { valid: false, reason: "URL too long" };
    }

    return { valid: true, url: urlObj.toString() };
  } catch (error) {
    return { valid: false, reason: "Invalid URL format" };
  }
};

/**
 * Extract and validate URLs from content
 */
const extractAndValidateUrls = (content) => {
  if (!content || typeof content !== "string") {
    return [];
  }

  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const cleanContent = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const urls = cleanContent.match(urlRegex) || [];

  return urls
    .map((url) => validateUrlEnhanced(url.trim()))
    .filter((result) => result.valid)
    .map((result) => result.url);
};

/**
 * Fetch Open Graph data from URL
 */
const fetchOpenGraphData = async (url) => {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "GameTribe Bot/1.0 (+https://gametribe.com/bot)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const $ = cheerio.load(response.data);

    // Extract Open Graph data
    const ogData = {
      title:
        $('meta[property="og:title"]').attr("content") ||
        $('meta[name="twitter:title"]').attr("content") ||
        $("title").text() ||
        "",
      description:
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="twitter:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        "",
      image:
        $('meta[property="og:image"]').attr("content") ||
        $('meta[name="twitter:image"]').attr("content") ||
        "",
      url: $('meta[property="og:url"]').attr("content") || url,
      siteName: $('meta[property="og:site_name"]').attr("content") || "",
      type: $('meta[property="og:type"]').attr("content") || "website",
    };

    // Clean and validate image URL
    if (ogData.image) {
      const imageValidation = validateUrlEnhanced(ogData.image);
      if (!imageValidation.valid) {
        ogData.image = "";
      } else {
        ogData.image = imageValidation.url;
      }
    }

    // Truncate description if too long
    if (ogData.description && ogData.description.length > 300) {
      ogData.description = ogData.description.substring(0, 300) + "...";
    }

    // Truncate title if too long
    if (ogData.title && ogData.title.length > 100) {
      ogData.title = ogData.title.substring(0, 100) + "...";
    }

    return ogData;
  } catch (error) {
    console.error("Error fetching Open Graph data:", error);
    return null;
  }
};

/**
 * Check if domain is allowed for Open Graph fetching
 */
const isDomainAllowed = (url) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    return ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith("." + domain)
    );
  } catch (error) {
    return false;
  }
};

/**
 * Middleware to validate URL in request
 */
const validateUrlMiddleware = (req, res, next) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        error: "URL parameter is required",
      });
    }

    const validation = validateUrlEnhanced(url);

    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid URL",
        reason: validation.reason,
      });
    }

    req.validatedUrl = validation.url;
    next();
  } catch (error) {
    console.error("URL validation error:", error);
    res.status(400).json({
      error: "URL validation failed",
    });
  }
};

/**
 * Middleware to extract and validate URLs from content
 */
const extractUrlsMiddleware = (req, res, next) => {
  try {
    const { content } = req.body;

    if (content) {
      const urls = extractAndValidateUrls(content);
      req.extractedUrls = urls;
    }

    next();
  } catch (error) {
    console.error("URL extraction error:", error);
    next(); // Continue processing even if URL extraction fails
  }
};

/**
 * Rate limiting for Open Graph requests
 */
const ogRequestCounts = new Map();
const OG_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per minute per IP
};

const rateLimitOgRequests = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!ogRequestCounts.has(clientIp)) {
    ogRequestCounts.set(clientIp, {
      count: 0,
      resetTime: now + OG_RATE_LIMIT.windowMs,
    });
  }

  const clientData = ogRequestCounts.get(clientIp);

  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + OG_RATE_LIMIT.windowMs;
  }

  if (clientData.count >= OG_RATE_LIMIT.maxRequests) {
    return res.status(429).json({
      error: "Too many requests",
      message: "Open Graph request rate limit exceeded",
    });
  }

  clientData.count++;
  next();
};

/**
 * Cache for Open Graph data
 */
const ogCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const getCachedOgData = (url) => {
  const cached = ogCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedOgData = (url, data) => {
  ogCache.set(url, {
    data,
    timestamp: Date.now(),
  });

  // Clean up old cache entries
  if (ogCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of ogCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        ogCache.delete(key);
      }
    }
  }
};

module.exports = {
  validateUrlEnhanced,
  extractAndValidateUrls,
  fetchOpenGraphData,
  isDomainAllowed,
  validateUrlMiddleware,
  extractUrlsMiddleware,
  rateLimitOgRequests,
  getCachedOgData,
  setCachedOgData,
  ALLOWED_DOMAINS,
  BLOCKED_DOMAINS,
};
