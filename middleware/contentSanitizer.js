const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");

/**
 * Content sanitization middleware
 * Sanitizes HTML content to prevent XSS attacks
 */
const sanitizeContent = (req, res, next) => {
  try {
    // Create a JSDOM window for DOMPurify
    const window = new JSDOM("").window;
    const purify = DOMPurify(window);

    // Sanitize content field if present
    if (req.body.content) {
      req.body.content = purify.sanitize(req.body.content, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "b",
          "i",
          "u",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "a",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
        ],
        ALLOWED_ATTR: ["href", "target", "rel"],
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
      });
    }

    // Sanitize description field if present (for events)
    if (req.body.description) {
      req.body.description = purify.sanitize(req.body.description, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "b",
          "i",
          "u",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "a",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
        ],
        ALLOWED_ATTR: ["href", "target", "rel"],
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
      });
    }

    // Sanitize message content if present (for chat)
    if (req.body.message) {
      req.body.message = purify.sanitize(req.body.message, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "b",
          "i",
          "u",
          "strong",
          "em",
          "ul",
          "ol",
          "li",
          "a",
        ],
        ALLOWED_ATTR: ["href", "target", "rel"],
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false,
      });
    }

    next();
  } catch (error) {
    console.error("Content sanitization error:", error);
    res.status(400).json({
      error: "Invalid content format",
      details: "Content could not be sanitized",
    });
  }
};

/**
 * Preprocess and clean Quill content
 * Handles the specific formatting from ReactQuill
 */
const preprocessQuillContent = (content) => {
  if (!content || typeof content !== "string") {
    return "";
  }

  // Decode HTML entities
  const decodeHtml = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  let cleanedContent = decodeHtml(content)
    .replace(/(<br\s*\/?>\s*)+/g, "</p><p>")
    .replace(/^<br\s*\/?>|<br\s*\/?>$/g, "")
    .replace(/<p>\s*<\/p>/g, "");

  if (!cleanedContent.startsWith("<") && cleanedContent.trim()) {
    cleanedContent = `<p>${cleanedContent}</p>`;
  }

  cleanedContent = cleanedContent.replace(
    /<li>\s*(.*?)\s*<\/li>/g,
    "<li>$1</li>"
  );

  return cleanedContent;
};

/**
 * Validate and sanitize URLs
 */
const validateUrl = (url) => {
  try {
    const urlObj = new URL(url);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return null;
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(url))) {
      return null;
    }

    return urlObj.toString();
  } catch (error) {
    return null;
  }
};

/**
 * Extract and validate URLs from content
 */
const extractUrls = (content) => {
  if (!content || typeof content !== "string") {
    return [];
  }

  const urlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const cleanContent = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const urls = cleanContent.match(urlRegex) || [];

  return urls
    .map((url) => validateUrl(url.trim()))
    .filter((url) => url !== null);
};

module.exports = {
  sanitizeContent,
  preprocessQuillContent,
  validateUrl,
  extractUrls,
};
