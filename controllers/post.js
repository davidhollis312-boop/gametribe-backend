const { database, storage } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");
const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const purify = DOMPurify(window);
const { processPointsForAction } = require("./points");

// ✅ NEW: Import production-grade services
const cacheService = require("../services/cache");
const batchOperationsService = require("../services/batchOperations");
const contentModerationService = require("../services/contentModeration");
const monitoringService = require("../services/monitoring");
const searchService = require("../services/search");

// Sanitize input to prevent XSS or invalid data and remove unnecessary HTML tags
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  // Sanitize and remove <p> tags if they are the only wrapper
  let sanitized = purify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "u", "strong", "em"],
  });
  // Remove wrapping <p> tags if they enclose the entire content
  if (sanitized.startsWith("<p>") && sanitized.endsWith("</p>")) {
    sanitized = sanitized.slice(3, -4).trim();
  }
  return sanitized;
};

// ✅ NEW: URL validation helper
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// ✅ NEW: Content moderation helper
const containsInappropriateContent = (content) => {
  const inappropriateWords = [
    "spam",
    "scam",
    "fake",
    "hate",
    "abuse",
    "harassment",
    "discrimination",
    "violence",
    "illegal",
    "fraud",
  ];

  const lowerContent = content.toLowerCase();
  return inappropriateWords.some((word) => lowerContent.includes(word));
};

const getPosts = async (req, res) => {
  const startTime = Date.now();
  try {
    const userId = req.user?.uid;
    const { page = 1, limit = 20, category, authorId, lastPostId } = req.query;

    // ✅ NEW: Input validation
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1-100",
      });
    }

    // ✅ NEW: Check cache first
    const cacheKey = `posts:${pageNum}:${limitNum}:${category || "all"}:${
      authorId || "all"
    }`;
    const cachedPosts = await cacheService.getPosts(
      pageNum,
      limitNum,
      category,
      authorId
    );

    if (cachedPosts) {
      monitoringService.trackCacheHit("posts");
      monitoringService.trackHttpRequest(
        req.method,
        req.route?.path || "/api/posts",
        200,
        Date.now() - startTime
      );
      return res.status(200).json(cachedPosts);
    }

    monitoringService.trackCacheMiss("posts");

    const postsRef = database.ref("posts");
    let query = postsRef.orderByChild("createdAt");

    // ✅ NEW: Implement pagination with cursor-based approach
    if (lastPostId) {
      // Get the timestamp of the last post for cursor-based pagination
      const lastPostRef = database.ref(`posts/${lastPostId}`);
      const lastPostSnapshot = await lastPostRef.once("value");
      if (lastPostSnapshot.exists()) {
        const lastPost = lastPostSnapshot.val();
        query = query.endAt(lastPost.createdAt);
      }
    }

    // Limit results
    query = query.limitToLast(limitNum + 1); // +1 to check if there are more posts

    const snapshot = await query.once("value");
    const postsData = snapshot.val() || {};

    // Convert to array and sort
    let posts = Object.entries(postsData).map(([id, data]) => ({
      id,
      ...data,
      likes: data.likes || 0,
      likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
      liked:
        userId && Array.isArray(data.likedBy)
          ? data.likedBy.includes(userId)
          : false,
      repostCount: data.repostCount || 0,
      directRepostCount: data.directRepostCount || 0,
      repostedBy: Array.isArray(data.repostedBy) ? data.repostedBy : [],
      reposted:
        userId && Array.isArray(data.repostedBy)
          ? data.repostedBy.includes(userId)
          : false,
      repostChain: data.repostChain || [],
      originalAuthor: data.originalAuthor || null,
      originalPostId: data.originalPostId || null,
    }));

    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ✅ NEW: Check if there are more posts
    const hasMore = posts.length > limitNum;
    if (hasMore) {
      posts = posts.slice(0, limitNum); // Remove the extra post
    }

    // ✅ NEW: Apply filters
    if (category) {
      posts = posts.filter((post) => post.category === category);
    }

    if (authorId) {
      posts = posts.filter((post) => post.authorId === authorId);
    }

    const response = {
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore,
        total: posts.length,
        lastPostId: posts.length > 0 ? posts[posts.length - 1].id : null,
      },
    };

    // ✅ NEW: Cache the results
    await cacheService.setPosts(
      response,
      pageNum,
      limitNum,
      category,
      authorId
    );

    // ✅ NEW: Track metrics
    monitoringService.trackDatabaseOperation(
      "read",
      "posts",
      Date.now() - startTime
    );
    monitoringService.trackHttpRequest(
      req.method,
      req.route?.path || "/api/posts",
      200,
      Date.now() - startTime
    );

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching posts:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
};

const createPost = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { content, category, imageLink } = req.body;

    console.log("🔍 CREATE POST DEBUG - Request received:", {
      userId,
      hasContent: !!content,
      contentType: typeof content,
      contentLength: content ? content.length : 0,
      contentPreview: content ? content.substring(0, 100) + "..." : "null",
      category,
      imageLink,
      hasFile: !!req.file,
      fileInfo: req.file
        ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null,
      bodyKeys: Object.keys(req.body),
      allBodyData: req.body,
    });

    // ✅ NEW: Enhanced input validation
    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      console.log("❌ VALIDATION FAILED - Content validation:", {
        hasContent: !!content,
        contentType: typeof content,
        contentLength: content ? content.length : 0,
        contentTrimmed: content ? content.trim().length : 0,
      });
      return res.status(400).json({
        error: "Post content is required and must be a non-empty string",
      });
    }

    if (content.length > 2000) {
      console.log("❌ VALIDATION FAILED - Content too long:", {
        contentLength: content.length,
        maxAllowed: 2000,
      });
      return res.status(400).json({
        error: "Post content cannot exceed 2000 characters",
      });
    }

    if (category && (typeof category !== "string" || category.length > 50)) {
      console.log("❌ VALIDATION FAILED - Category validation:", {
        category,
        categoryType: typeof category,
        categoryLength: category ? category.length : 0,
        maxAllowed: 50,
      });
      return res.status(400).json({
        error: "Category must be a string with maximum 50 characters",
      });
    }

    if (
      imageLink &&
      (typeof imageLink !== "string" || !isValidUrl(imageLink))
    ) {
      console.log("❌ VALIDATION FAILED - Image link validation:", {
        imageLink,
        imageLinkType: typeof imageLink,
        isValidUrl: imageLink ? isValidUrl(imageLink) : false,
      });
      return res.status(400).json({
        error: "Image link must be a valid URL",
      });
    }

    // ✅ NEW: Advanced content moderation
    console.log("🔍 Running content moderation check...");
    const moderationResult = await contentModerationService.moderateContent(
      content,
      "post",
      userId
    );
    console.log("🔍 Content moderation result:", moderationResult);

    if (!moderationResult.isApproved) {
      console.log("❌ VALIDATION FAILED - Content moderation:", {
        isApproved: moderationResult.isApproved,
        reasons: moderationResult.reasons,
        flags: moderationResult.flags,
        severity: moderationResult.severity,
      });
      monitoringService.trackContentFlagged(
        "inappropriate",
        moderationResult.severity
      );
      return res.status(400).json({
        error: "Post content violates community guidelines",
        details: moderationResult.reasons,
        flags: moderationResult.flags,
      });
    }

    monitoringService.trackContentModerated("post", "approved");
    const sanitizedContent = sanitizeInput(content);
    console.log("🔍 Content sanitized:", {
      originalLength: content.length,
      sanitizedLength: sanitizedContent.length,
      sanitizedPreview: sanitizedContent.substring(0, 100) + "...",
    });

    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      console.log("❌ VALIDATION FAILED - User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();

    // Validate user data structure
    if (!userData) {
      console.log("❌ VALIDATION FAILED - User data not found:", userId);
      return res.status(404).json({ error: "User data not found" });
    }

    console.log("🔍 User data retrieved:", {
      userId,
      hasUsername: !!userData.username,
      username: userData.username,
      hasEmail: !!userData.email,
      email: userData.email,
      hasAvatar: !!userData.avatar,
    });

    // Ensure user has proper username - prioritize Google displayName
    if (
      !userData.username ||
      userData.username === "User" ||
      userData.username.trim() === ""
    ) {
      let fallbackUsername;

      // Priority order: Google displayName > email prefix > user ID
      if (req.user.name && req.user.name.trim()) {
        fallbackUsername = req.user.name.trim();
      } else if (userData.email && userData.email.includes("@")) {
        fallbackUsername = userData.email.split("@")[0];
      } else {
        fallbackUsername = `User_${userId.substring(0, 8)}`;
      }

      // Update the user's username in the database
      await userRef.update({ username: fallbackUsername });
      userData.username = fallbackUsername;

      console.log("🔧 Updated user username in post creation:", {
        userId,
        newUsername: fallbackUsername,
        googleName: req.user.name,
        email: userData.email,
      });
    }

    let imageUrl = sanitizeInput(imageLink) || "";
    let mediaType = "image"; // Default to image
    let duration = null; // For videos

    console.log("🔍 Processing media:", {
      hasFile: !!req.file,
      hasImageLink: !!imageLink,
      imageLink: imageLink,
    });

    if (req.file && req.file.buffer && req.file.buffer.length > 0) {
      const file = req.file;
      console.log("🔍 File processing:", {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fieldname: file.fieldname,
      });

      if (
        !file.mimetype.startsWith("image/") &&
        !file.mimetype.startsWith("video/") &&
        !file.mimetype.startsWith("audio/")
      ) {
        console.log("❌ VALIDATION FAILED - Invalid file type:", file.mimetype);
        return res
          .status(400)
          .json({ error: "Only image, video, and audio files are allowed" });
      }

      // For videos, validate duration (1 minute max)
      if (file.mimetype.startsWith("video/")) {
        mediaType = "video";

        // Check if duration is provided in the request
        if (req.body.duration) {
          const videoDuration = parseFloat(req.body.duration);
          const maxDuration = 60; // 1 minute in seconds

          if (videoDuration > maxDuration) {
            return res.status(400).json({
              error: `Video duration must be 1 minute or less. Current duration: ${Math.round(
                videoDuration
              )} seconds.`,
            });
          }
          duration = videoDuration;
        }
      } else if (file.mimetype.startsWith("audio/")) {
        mediaType = "audio";

        // Check if duration is provided in the request for audio
        if (req.body.duration) {
          const audioDuration = parseFloat(req.body.duration);
          const maxDuration = 300; // 5 minutes for audio

          if (audioDuration > maxDuration) {
            return res.status(400).json({
              error: `Audio duration must be 5 minutes or less. Current duration: ${Math.round(
                audioDuration
              )} seconds.`,
            });
          }
          duration = audioDuration;
        }
      }

      const fileName = `posts/${Date.now()}-${file.originalname}`;
      // Use unified storage utility method (handles both Firebase and fallback)
      const uploaded = await storage.uploadFile(file, fileName);
      if (uploaded && uploaded.url) {
        imageUrl = uploaded.url;
      } else if (uploaded && typeof uploaded.getSignedUrl === "function") {
        const [signedUrl] = await uploaded.getSignedUrl({
          action: "read",
          expires: "03-09-2491",
        });
        imageUrl = signedUrl;
      }
    } else if (imageLink) {
      // For URL-based media, determine type from extension
      const url = new URL(imageLink);
      const extension = url.pathname.split(".").pop().toLowerCase();
      const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi"];
      const audioExtensions = ["mp3", "wav", "ogg", "m4a", "aac", "flac"];

      if (videoExtensions.includes(extension)) {
        mediaType = "video";
      } else if (audioExtensions.includes(extension)) {
        mediaType = "audio";
      } else {
        mediaType = "image";
      }
    }
    const postId = uuidv4();
    const newPost = {
      authorId: userId,
      author: userData.username,
      authorImage: userData.avatar || "",
      content: sanitizedContent,
      category: sanitizeInput(category) || "",
      image: imageUrl,
      mediaType: mediaType,
      duration: duration,
      createdAt: new Date().toISOString(),
      comments: 0,
      likes: 0,
      likedBy: [],
      repostCount: 0,
      directRepostCount: 0,
      repostedBy: [],
      isRepost: false,
      originalPostId: null,
      originalPost: null,
      repostChain: [],
      originalAuthor: null,
    };

    console.log("🔍 Creating post with data:", {
      postId,
      authorId: newPost.authorId,
      author: newPost.author,
      contentLength: newPost.content.length,
      category: newPost.category,
      hasImage: !!newPost.image,
      mediaType: newPost.mediaType,
      duration: newPost.duration,
    });

    await database.ref(`posts/${postId}`).set(newPost);
    console.log("✅ Post created successfully:", postId);

    // ✅ NEW: Invalidate cache
    await cacheService.invalidatePosts();
    await cacheService.setPost(postId, newPost);

    // ✅ NEW: Track metrics
    monitoringService.trackPostCreated(newPost.category, "regular");
    monitoringService.trackDatabaseOperation("create", "posts");

    // Add points for creating a post
    try {
      await processPointsForAction(userId, "POST_DISCUSSION", {
        postId,
        category: newPost.category,
      });
    } catch (pointsError) {
      console.error("Error adding points for post creation:", pointsError);
      monitoringService.trackError("points_system_error", "low");
      // Don't fail the post creation if points fail
    }

    console.log("🎉 Post creation completed successfully");
    return res.status(201).json({ id: postId, ...newPost });
  } catch (error) {
    console.error("❌ ERROR creating post:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
    });
    return res.status(500).json({ error: "Failed to create post" });
  }
};

const likePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.uid;
    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }
    const postRef = database.ref(`posts/${postId}`);
    const result = await postRef.transaction((postData) => {
      if (!postData) {
        return null;
      }
      const likedBy = Array.isArray(postData.likedBy) ? postData.likedBy : [];
      const likes = postData.likes || 0;
      const isLiked = likedBy.includes(userId);
      if (isLiked) {
        postData.likes = likes > 0 ? likes - 1 : 0;
        postData.likedBy = likedBy.filter((id) => id !== userId);
      } else {
        postData.likes = likes + 1;
        postData.likedBy = [...new Set([...likedBy, userId])];
      }
      return postData;
    });
    if (!result.committed) {
      return res.status(404).json({ error: "Post not found" });
    }
    const postData = result.snapshot.val();
    const isLiked = postData.likedBy.includes(userId);

    // Add points for liking (only when liking, not unliking)
    if (isLiked) {
      try {
        await processPointsForAction(userId, "LIKE_POST", {
          postId,
          action: "like",
        });
      } catch (pointsError) {
        console.error("Error adding points for liking post:", pointsError);
        // Don't fail the like action if points fail
      }
    }

    return res.status(200).json({
      liked: isLiked,
      likes: postData.likes,
    });
  } catch (error) {
    console.error("Error liking post:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to like post" });
  }
};

const getComments = async (req, res) => {
  try {
    const postId = req.params.postId;
    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }
    const postRef = database.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once("value");
    if (!postSnapshot.exists()) {
      return res.status(404).json({ error: "Post not found" });
    }
    const commentsRef = database.ref(`posts/${postId}/comments`);
    const commentsSnapshot = await commentsRef
      .orderByChild("createdAt")
      .once("value");
    const commentsData = commentsSnapshot.val() || {};
    const comments = [];
    for (const [commentId, commentData] of Object.entries(commentsData)) {
      const repliesRef = database.ref(
        `posts/${postId}/comments/${commentId}/replies`
      );
      const repliesSnapshot = await repliesRef
        .orderByChild("createdAt")
        .once("value");
      const repliesData = repliesSnapshot.val() || {};
      commentData.id = commentId;
      commentData.likes = commentData.likes || 0;
      commentData.likedBy = Array.isArray(commentData.likedBy)
        ? commentData.likedBy
        : [];
      commentData.replies = Object.entries(repliesData).map(
        ([replyId, replyData]) => ({
          id: replyId,
          ...replyData,
          likes: replyData.likes || 0,
          likedBy: Array.isArray(replyData.likedBy) ? replyData.likedBy : [],
        })
      );
      comments.push(commentData);
    }
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
};

const createComment = async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.user.uid;
    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }
    if (!req.body.content && !req.file) {
      return res
        .status(400)
        .json({ error: "Comment content or attachment is required" });
    }
    const sanitizedContent = sanitizeInput(req.body.content) || "";
    const postRef = database.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once("value");
    if (!postSnapshot.exists()) {
      return res.status(404).json({ error: "Post not found" });
    }
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();

    // Validate user data structure
    if (!userData) {
      return res.status(404).json({ error: "User data not found" });
    }

    let attachmentUrl = "";
    if (req.file && req.file.buffer && req.file.buffer.length > 0) {
      const file = req.file;
      if (
        !file.mimetype.startsWith("image/") &&
        !file.mimetype.startsWith("video/") &&
        !file.mimetype.startsWith("audio/")
      ) {
        return res
          .status(400)
          .json({ error: "Only image, video, and audio files are allowed" });
      }
      const fileName = `posts/${postId}/comments/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const commentId = uuidv4();
    const comment = {
      id: commentId,
      postId,
      authorId: userId,
      author:
        userData.username ||
        (userData.email ? userData.email.split("@")[0] : "Unknown User"),
      authorImage: userData.avatar || "",
      content: sanitizedContent,
      image: attachmentUrl,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };
    await database.ref(`posts/${postId}/comments/${commentId}`).set(comment);
    await postRef.update({ comments: (postSnapshot.val().comments || 0) + 1 });

    // Add points for commenting
    try {
      await processPointsForAction(userId, "COMMENT_POST", {
        postId,
        commentId,
        action: "comment",
      });
    } catch (pointsError) {
      console.error("Error adding points for commenting:", pointsError);
      // Don't fail the comment creation if points fail
    }

    return res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to create comment" });
  }
};

const createReply = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.uid;
    if (!postId || !commentId) {
      return res
        .status(400)
        .json({ error: "Post ID and Comment ID are required" });
    }
    if (!req.body.content && !req.file) {
      return res
        .status(400)
        .json({ error: "Reply content or attachment is required" });
    }
    const sanitizedContent = sanitizeInput(req.body.content) || "";
    const postRef = database.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once("value");
    if (!postSnapshot.exists()) {
      return res.status(404).json({ error: "Post not found" });
    }
    const commentRef = database.ref(`posts/${postId}/comments/${commentId}`);
    const commentSnapshot = await commentRef.once("value");
    if (!commentSnapshot.exists()) {
      return res.status(404).json({ error: "Comment not found" });
    }
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();

    // Validate user data structure
    if (!userData) {
      return res.status(404).json({ error: "User data not found" });
    }

    let attachmentUrl = "";
    if (req.file && req.file.buffer && req.file.buffer.length > 0) {
      const file = req.file;
      if (
        !file.mimetype.startsWith("image/") &&
        !file.mimetype.startsWith("video/") &&
        !file.mimetype.startsWith("audio/")
      ) {
        return res
          .status(400)
          .json({ error: "Only image, video, and audio files are allowed" });
      }
      const fileName = `posts/${postId}/comments/${commentId}/replies/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const replyId = uuidv4();
    const reply = {
      id: replyId,
      postId,
      commentId,
      authorId: userId,
      author:
        userData.username ||
        (userData.email ? userData.email.split("@")[0] : "Unknown User"),
      authorImage: userData.avatar || "",
      content: sanitizedContent,
      image: attachmentUrl,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };
    await database
      .ref(`posts/${postId}/comments/${commentId}/replies/${replyId}`)
      .set(reply);

    // Update comment replies count instead of post comments count
    await commentRef.update({
      replies: (commentSnapshot.val().replies || 0) + 1,
    });

    return res.status(201).json(reply);
  } catch (error) {
    console.error("Error creating reply:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to create reply" });
  }
};

const likeComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user.uid;
    if (!postId || !commentId) {
      return res
        .status(400)
        .json({ error: "Post ID and Comment ID are required" });
    }
    const commentRef = database.ref(`posts/${postId}/comments/${commentId}`);
    const result = await commentRef.transaction((commentData) => {
      if (!commentData) {
        return null;
      }
      const likedBy = Array.isArray(commentData.likedBy)
        ? commentData.likedBy
        : [];
      const likes = commentData.likes || 0;
      const isLiked = likedBy.includes(userId);
      if (isLiked) {
        commentData.likes = likes > 0 ? likes - 1 : 0;
        commentData.likedBy = likedBy.filter((id) => id !== userId);
      } else {
        commentData.likes = likes + 1;
        commentData.likedBy = [...new Set([...likedBy, userId])];
      }
      return commentData;
    });
    if (!result.committed) {
      return res.status(404).json({ error: "Comment not found" });
    }
    const commentData = result.snapshot.val();
    return res.status(200).json({
      liked: commentData.likedBy.includes(userId),
      likes: commentData.likes,
    });
  } catch (error) {
    console.error("Error liking comment:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to like comment" });
  }
};

const likeReply = async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;
    const userId = req.user.uid;
    if (!postId || !commentId || !replyId) {
      return res
        .status(400)
        .json({ error: "Post ID, Comment ID, and Reply ID are required" });
    }
    const replyRef = database.ref(
      `posts/${postId}/comments/${commentId}/replies/${replyId}`
    );
    const result = await replyRef.transaction((replyData) => {
      if (!replyData) {
        return null;
      }
      const likedBy = Array.isArray(replyData.likedBy) ? replyData.likedBy : [];
      const likes = replyData.likes || 0;
      const isLiked = likedBy.includes(userId);
      if (isLiked) {
        replyData.likes = likes > 0 ? likes - 1 : 0;
        replyData.likedBy = likedBy.filter((id) => id !== userId);
      } else {
        replyData.likes = likes + 1;
        replyData.likedBy = [...new Set([...likedBy, userId])];
      }
      return replyData;
    });
    if (!result.committed) {
      return res.status(404).json({ error: "Reply not found" });
    }
    const replyData = result.snapshot.val();
    return res.status(200).json({
      liked: replyData.likedBy.includes(userId),
      likes: replyData.likes,
    });
  } catch (error) {
    console.error("Error liking reply:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to like reply" });
  }
};

const repostPost = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { postId } = req.params;
    const { comment } = req.body; // Optional comment for the repost

    console.log("🔄 Backend repostPost called:", { userId, postId, comment });

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    // Get the original post
    const originalPostRef = database.ref(`posts/${postId}`);
    const originalPostSnapshot = await originalPostRef.once("value");

    if (!originalPostSnapshot.exists()) {
      console.log("❌ Original post not found:", postId);
      return res.status(404).json({ error: "Original post not found" });
    }

    const originalPost = originalPostSnapshot.val();
    console.log("📊 Original post data:", {
      id: originalPost.id,
      author: originalPost.author,
      isRepost: originalPost.isRepost,
      repostedBy: originalPost.repostedBy || [],
    });

    // Prevent reposting your own post
    if (originalPost.authorId === userId) {
      console.log("❌ User attempted to repost own post:", { userId, postId });
      return res.status(400).json({ error: "You cannot repost your own post" });
    }

    // NEW LOGIC: Prevent reposting of reposts
    if (originalPost.isRepost) {
      console.log("❌ Cannot repost a repost:", postId);
      return res.status(400).json({
        error:
          "You can only repost original content, not reposts. Please repost the original post instead.",
      });
    }

    // Check if user already reposted this post
    if (originalPost.repostedBy && originalPost.repostedBy.includes(userId)) {
      console.log("❌ User already reposted:", { userId, postId });
      return res
        .status(400)
        .json({ error: "You have already reposted this post" });
    }

    // Get user data
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      console.log("❌ User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();

    // Validate user data structure
    if (!userData) {
      console.log("❌ User data not found:", userId);
      return res.status(404).json({ error: "User data not found" });
    }

    // Ensure user has proper username - prioritize Google displayName
    if (
      !userData.username ||
      userData.username === "User" ||
      userData.username.trim() === ""
    ) {
      let fallbackUsername;

      // Priority order: Google displayName > email prefix > user ID
      if (req.user.name && req.user.name.trim()) {
        fallbackUsername = req.user.name.trim();
      } else if (userData.email && userData.email.includes("@")) {
        fallbackUsername = userData.email.split("@")[0];
      } else {
        fallbackUsername = `User_${userId.substring(0, 8)}`;
      }

      // Update the user's username in the database
      await userRef.update({ username: fallbackUsername });
      userData.username = fallbackUsername;

      console.log("🔧 Updated user username in repost creation:", {
        userId,
        newUsername: fallbackUsername,
        googleName: req.user.name,
        email: userData.email,
      });
    }

    console.log("👤 User data:", {
      username: userData.username,
      email: userData.email,
      hasUsername: !!userData.username,
      hasEmail: !!userData.email,
      emailType: typeof userData.email,
      fullUserData: userData,
    });

    // Build repost chain - since we only allow reposting original content, this is always the first level
    const repostChain = [
      {
        postId: originalPost.id || postId,
        authorId: originalPost.authorId,
        author: originalPost.author,
        timestamp: originalPost.createdAt,
      },
    ];

    // Create repost with enhanced data structure
    const repostId = uuidv4();
    // Use the username we just ensured exists
    const authorName = userData.username || `User_${userId.substring(0, 8)}`;

    console.log("📝 Creating repost with author name:", authorName, {
      username: userData.username,
      email: userData.email,
      displayName: userData.displayName,
      userId: userId,
    });

    const repostData = {
      id: repostId, // ✅ Add the ID field
      authorId: userId,
      author: authorName,
      authorImage: userData.avatar || "",
      content: comment || "", // Optional comment
      category: originalPost.category || "",
      image: originalPost.image || "", // Preserve original post's media
      mediaType: originalPost.mediaType || "", // Preserve media type
      duration: originalPost.duration || null, // Preserve duration for videos
      createdAt: new Date().toISOString(),
      comments: 0,
      likes: 0,
      likedBy: [],
      repostCount: 0,
      directRepostCount: 0,
      repostedBy: [],
      isRepost: true,
      originalPostId: postId, // Points to the original post being reposted
      originalPost: {
        id: originalPost.id || postId, // ✅ Use postId if originalPost.id is missing
        author: originalPost.author,
        authorId: originalPost.authorId,
        authorImage: originalPost.authorImage || "", // ✅ Include author image
        content: originalPost.content,
        image: originalPost.image || "",
        mediaType: originalPost.mediaType || "", // Include media type
        duration: originalPost.duration || null, // Include duration
        category: originalPost.category || "",
        createdAt: originalPost.createdAt,
      },
      repostChain: repostChain, // Always just the original post since no nested reposts
      originalAuthor: originalPost.author, // Always points to the original author
    };

    console.log("🔍 Backend repost data being created:", {
      repostId,
      originalImage: originalPost.image,
      originalMediaType: originalPost.mediaType,
      repostImage: repostData.image,
      repostMediaType: repostData.mediaType,
      originalPostImage: repostData.originalPost.image,
      originalPostMediaType: repostData.originalPost.mediaType,
    });

    console.log("💾 Repost data to save:", {
      repostId,
      author: repostData.author,
      authorId: repostData.authorId,
      hasAuthor: !!repostData.author,
      authorType: typeof repostData.author,
    });

    // Save repost
    await database.ref(`posts/${repostId}`).set(repostData);
    console.log("✅ Repost saved to database");

    // Verify the data was saved correctly
    const savedRepostRef = database.ref(`posts/${repostId}`);
    const savedRepostSnapshot = await savedRepostRef.once("value");
    const savedRepostData = savedRepostSnapshot.val();
    console.log(
      "🔍 Verification - saved repost author:",
      savedRepostData?.author
    );

    // Update the original post being reposted
    const newRepostedBy = [...(originalPost.repostedBy || []), userId];
    const newDirectRepostCount = (originalPost.directRepostCount || 0) + 1;
    const newRepostCount = (originalPost.repostCount || 0) + 1;

    await originalPostRef.update({
      directRepostCount: newDirectRepostCount,
      repostedBy: newRepostedBy,
      repostCount: newRepostCount,
    });
    console.log("✅ Original post updated with new repost counts");

    // Add points for reposting
    try {
      await processPointsForAction(userId, "REPOST_POST", {
        postId: repostId,
        originalPostId: postId,
        category: originalPost.category,
      });
      console.log("✅ Points added for repost");
    } catch (pointsError) {
      console.warn("Failed to add points for repost:", pointsError);
    }

    console.log("🎉 Repost completed successfully:", {
      repostId,
      newRepostCount,
    });
    return res.status(201).json({
      message: "Post reposted successfully",
      repostId,
      repostCount: newRepostCount,
      repostData: repostData, // Return the complete repost data
    });
  } catch (error) {
    console.error("❌ Error reposting post:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to repost post" });
  }
};

const getRepostChain = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    // Get the post
    const postRef = database.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once("value");

    if (!postSnapshot.exists()) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postSnapshot.val();

    // If it's not a repost, return empty chain
    if (!post.isRepost) {
      return res.status(200).json({
        repostChain: [],
        originalPost: post,
        isOriginal: true,
      });
    }

    // Get the repost chain
    const repostChain = post.repostChain || [];

    // Get the original post
    let originalPost = null;
    if (post.originalPostId) {
      const originalPostRef = database.ref(`posts/${post.originalPostId}`);
      const originalPostSnapshot = await originalPostRef.once("value");
      if (originalPostSnapshot.exists()) {
        originalPost = originalPostSnapshot.val();
      }
    }

    return res.status(200).json({
      repostChain,
      originalPost,
      isOriginal: false,
      originalAuthor: post.originalAuthor,
      repostDepth: repostChain.length,
    });
  } catch (error) {
    console.error("Error getting repost chain:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to get repost chain" });
  }
};

// ✅ NEW: Get reposts of a specific post
const getReposts = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    // Get all posts and filter for reposts of this post
    const postsRef = database.ref("posts");
    const snapshot = await postsRef
      .orderByChild("originalPostId")
      .equalTo(postId)
      .once("value");

    if (!snapshot.exists()) {
      return res.status(200).json({
        reposts: [],
        totalCount: 0,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    }

    const repostsData = snapshot.val() || {};
    const repostsArray = Object.entries(repostsData)
      .map(([id, repost]) => ({
        id,
        ...repost,
        author: repost.author || "Unknown Author",
        authorImage: repost.authorImage || "",
        content: repost.content || "",
        createdAt: repost.createdAt || new Date().toISOString(),
        likes: repost.likes || 0,
        likedBy: Array.isArray(repost.likedBy) ? repost.likedBy : [],
        comments: repost.comments || 0,
        repostChain: Array.isArray(repost.repostChain)
          ? repost.repostChain
          : [],
        originalAuthor: repost.originalAuthor || null,
        originalPostId: repost.originalPostId || null,
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedReposts = repostsArray.slice(startIndex, endIndex);

    return res.status(200).json({
      reposts: paginatedReposts,
      totalCount: repostsArray.length,
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: endIndex < repostsArray.length,
    });
  } catch (error) {
    console.error("Error getting reposts:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to get reposts" });
  }
};

const unrepostPost = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    // Get the original post
    const originalPostRef = database.ref(`posts/${postId}`);
    const originalPostSnapshot = await originalPostRef.once("value");

    if (!originalPostSnapshot.exists()) {
      return res.status(404).json({ error: "Original post not found" });
    }

    const originalPost = originalPostSnapshot.val();

    // Check if user has reposted this post
    if (!originalPost.repostedBy || !originalPost.repostedBy.includes(userId)) {
      return res.status(400).json({ error: "You have not reposted this post" });
    }

    // Remove repost from the post being reposted
    const newRepostedBy = originalPost.repostedBy.filter((id) => id !== userId);
    const newDirectRepostCount = Math.max(
      0,
      (originalPost.directRepostCount || 0) - 1
    );

    await originalPostRef.update({
      directRepostCount: newDirectRepostCount,
      repostedBy: newRepostedBy,
    });

    // Update original post (Chris's post) total repost count
    if (originalPost.isRepost) {
      // This is a repost, so update the original original post
      const originalOriginalPostRef = database.ref(
        `posts/${originalPost.originalPostId || originalPost.id}`
      );
      const originalOriginalSnapshot = await originalOriginalPostRef.once(
        "value"
      );
      if (originalOriginalSnapshot.exists()) {
        const originalOriginalData = originalOriginalSnapshot.val();
        await originalOriginalPostRef.update({
          repostCount: Math.max(0, (originalOriginalData.repostCount || 0) - 1),
        });
      }
    } else {
      // This is the original post, update its total count
      await originalPostRef.update({
        repostCount: Math.max(0, (originalPost.repostCount || 0) - 1),
      });
    }

    // Find and delete the repost
    const postsRef = database.ref("posts");
    const repostSnapshot = await postsRef
      .orderByChild("originalPostId")
      .equalTo(postId)
      .once("value");

    if (repostSnapshot.exists()) {
      const repostEntries = Object.entries(repostSnapshot.val());
      const userRepost = repostEntries.find(
        ([_, repost]) => repost.authorId === userId
      );

      if (userRepost) {
        await database.ref(`posts/${userRepost[0]}`).remove();
      }
    }

    return res.status(200).json({
      message: "Repost removed successfully",
      repostCount: newDirectRepostCount,
    });
  } catch (error) {
    console.error("Error removing repost:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to remove repost" });
  }
};

const updatePost = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { postId } = req.params;
    const { content, category, imageLink } = req.body;

    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return res.status(400).json({
        error: "Post content is required and must be a non-empty string",
      });
    }

    // Get the post to check ownership
    const postRef = database.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once("value");

    if (!postSnapshot.exists()) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postSnapshot.val();

    // Check if user owns the post
    if (post.authorId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only edit your own posts" });
    }

    const sanitizedContent = sanitizeInput(content);
    let imageUrl = sanitizeInput(imageLink) || post.image || "";

    // Handle file upload if provided
    if (req.file && req.file.buffer && req.file.buffer.length > 0) {
      const file = req.file;
      if (
        !file.mimetype.startsWith("image/") &&
        !file.mimetype.startsWith("video/") &&
        !file.mimetype.startsWith("audio/")
      ) {
        return res
          .status(400)
          .json({ error: "Only image, video, and audio files are allowed" });
      }

      // For videos, validate duration (1 minute max)
      if (file.mimetype.startsWith("video/")) {
        if (req.body.duration) {
          const videoDuration = parseFloat(req.body.duration);
          const maxDuration = 60; // 1 minute in seconds

          if (videoDuration > maxDuration) {
            return res.status(400).json({
              error: `Video duration must be 1 minute or less. Current duration: ${Math.round(
                videoDuration
              )} seconds.`,
            });
          }
        }
      } else if (file.mimetype.startsWith("audio/")) {
        if (req.body.duration) {
          const audioDuration = parseFloat(req.body.duration);
          const maxDuration = 300; // 5 minutes for audio

          if (audioDuration > maxDuration) {
            return res.status(400).json({
              error: `Audio duration must be 5 minutes or less. Current duration: ${Math.round(
                audioDuration
              )} seconds.`,
            });
          }
        }
      }

      const fileName = `posts/${Date.now()}-${file.originalname}`;
      // Use the new storage utility methods
      if (storage.isFallback) {
        // Use fallback storage
        const result = await storage.uploadFile(file, fileName);
        imageUrl = result.url;
      } else {
        // Use Firebase Storage
        const fileRef = storage.file(fileName);
        await fileRef.save(file.buffer, { contentType: file.mimetype });
        [imageUrl] = await fileRef.getSignedUrl({
          action: "read",
          expires: "03-09-2491",
        });
      }
    }

    // Determine media type and duration for updated post
    let mediaType = post.mediaType || "image";
    let duration = post.duration || null;

    if (req.file) {
      if (req.file.mimetype.startsWith("video/")) {
        mediaType = "video";
        if (req.body.duration) {
          duration = parseFloat(req.body.duration);
        }
      } else {
        mediaType = "image";
        duration = null;
      }
    } else if (imageLink) {
      // For URL-based media, determine type from extension
      try {
        const url = new URL(imageLink);
        const extension = url.pathname.split(".").pop().toLowerCase();
        const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi"];
        mediaType = videoExtensions.includes(extension) ? "video" : "image";
        duration = null; // Duration not available for URL-based media
      } catch (e) {
        mediaType = "image";
        duration = null;
      }
    }

    // Update the post
    const updatedPost = {
      content: sanitizedContent,
      category: sanitizeInput(category) || post.category || "",
      image: imageUrl,
      mediaType: mediaType,
      duration: duration,
      updatedAt: new Date().toISOString(),
    };

    await postRef.update(updatedPost);

    // Get the updated post
    const updatedSnapshot = await postRef.once("value");
    const finalPost = updatedSnapshot.val();

    return res.status(200).json({
      message: "Post updated successfully",
      post: {
        id: postId,
        ...finalPost,
      },
    });
  } catch (error) {
    console.error("Error updating post:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to update post" });
  }
};

const deletePost = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { postId } = req.params;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    // Get the post to check ownership
    const postRef = database.ref(`posts/${postId}`);
    const postSnapshot = await postRef.once("value");

    if (!postSnapshot.exists()) {
      return res.status(404).json({ error: "Post not found" });
    }

    const post = postSnapshot.val();

    // Check if user owns the post
    if (post.authorId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only delete your own posts" });
    }

    console.log("🗑️ Starting comprehensive post deletion for:", postId);

    // Handle different deletion scenarios
    if (post.isRepost) {
      // Case 1: Reposter is deleting their own repost
      console.log("📝 Deleting repost:", postId);

      // Update the original post's repost counts
      if (post.originalPostId) {
        try {
          const originalPostRef = database.ref(`posts/${post.originalPostId}`);
          const originalPostSnapshot = await originalPostRef.once("value");

          if (originalPostSnapshot.exists()) {
            const originalPost = originalPostSnapshot.val();
            const newRepostedBy = (originalPost.repostedBy || []).filter(
              (id) => id !== userId
            );
            const newDirectRepostCount = Math.max(
              0,
              (originalPost.directRepostCount || 0) - 1
            );
            const newRepostCount = Math.max(
              0,
              (originalPost.repostCount || 0) - 1
            );

            await originalPostRef.update({
              repostedBy: newRepostedBy,
              directRepostCount: newDirectRepostCount,
              repostCount: newRepostCount,
            });

            console.log("✅ Updated original post repost counts");
          }
        } catch (error) {
          console.error("⚠️ Error updating original post counts:", error);
        }
      }

      // Soft delete the repost
      const deletedRepost = {
        ...post,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        content: "[This repost was deleted by the author]",
        image: "", // Remove any image
        originalPost: post.originalPost, // Keep original post reference
        originalPostId: post.originalPostId, // Keep original post ID
        isRepost: true, // Keep as repost
        repostChain: post.repostChain, // Keep repost chain
        originalAuthor: post.originalAuthor, // Keep original author
      };

      await postRef.set(deletedRepost);
      console.log("✅ Repost soft deleted successfully");

      return res.status(200).json({
        message: "Repost deleted successfully",
        postId: postId,
      });
    } else {
      // Case 2: Original creator is deleting their original post
      console.log("🗑️ Deleting original post and all references:", postId);

      // Step 1: Handle all reposts that reference this original post
      try {
        const postsSnapshot = await database.ref("posts").once("value");
        const postsData = postsSnapshot.val() || {};

        const updates = {};
        let repostCount = 0;

        Object.entries(postsData).forEach(([id, data]) => {
          const isRepost = !!data?.isRepost;
          const referencesOriginal = data?.originalPostId === postId;

          if (isRepost && referencesOriginal) {
            repostCount++;
            console.log(
              `📝 Updating repost ${id} - marking original as deleted`
            );

            // Create a proper deleted original post structure
            const deletedOriginalPost = {
              id: postId,
              author: post.author || "Unknown Author",
              authorId: post.authorId || null,
              authorImage: post.authorImage || "",
              content: "[Original post deleted by the author]",
              image: "",
              category: post.category || "",
              createdAt: post.createdAt || new Date().toISOString(),
              isDeleted: true,
              deletedAt: new Date().toISOString(),
            };

            // Update repost to reference deleted original
            updates[`posts/${id}/originalDeleted`] = true;
            updates[`posts/${id}/originalPost`] = deletedOriginalPost;
            updates[`posts/${id}/originalPostId`] = postId; // Keep reference for traceability

            // If the repost has no own content, add a placeholder
            if (!data.content || data.content.trim() === "") {
              updates[`posts/${id}/content`] = "[Original post deleted]";
            }
          }
        });

        console.log(`🔄 Found ${repostCount} reposts to update`);
        if (Object.keys(updates).length > 0) {
          await database.ref().update(updates);
          console.log("✅ Successfully updated all reposts");
        }
      } catch (error) {
        console.error("Error updating reposts after original deletion:", error);
      }

      // Step 2: Delete all comments associated with this post
      try {
        const commentsRef = database.ref(`posts/${postId}/comments`);
        const commentsSnapshot = await commentsRef.once("value");

        if (commentsSnapshot.exists()) {
          const commentsData = commentsSnapshot.val();
          const commentCount = Object.keys(commentsData).length;
          console.log(
            `🗑️ Deleting ${commentCount} comments for post ${postId}`
          );

          // Delete all comments and their replies
          await commentsRef.remove();
          console.log("✅ All comments deleted successfully");
        }
      } catch (error) {
        console.error("Error deleting comments:", error);
      }

      // Step 3: Clean up any user profile references (if they exist)
      try {
        // Check if user profiles store post references
        const userRef = database.ref(`users/${userId}`);
        const userSnapshot = await userRef.once("value");

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();

          // Validate user data structure
          if (!userData) {
            console.log("⚠️ User data is null for user:", userId);
            return;
          }

          let userUpdated = false;
          const userUpdates = {};

          // Check for post references in user data (if any exist)
          // This is a placeholder for future user profile post references
          if (userData.posts && Array.isArray(userData.posts)) {
            const updatedPosts = userData.posts.filter((p) => p !== postId);
            if (updatedPosts.length !== userData.posts.length) {
              userUpdates.posts = updatedPosts;
              userUpdated = true;
            }
          }

          if (userUpdated) {
            await userRef.update(userUpdates);
            console.log("✅ Cleaned up user profile references");
          }
        }
      } catch (error) {
        console.error("Error cleaning up user profile references:", error);
      }

      // Step 4: Clean up points system references (if they exist)
      try {
        // Check if points system stores post references
        const pointsRef = database.ref("points");
        const pointsSnapshot = await pointsRef.once("value");

        if (pointsSnapshot.exists()) {
          const pointsData = pointsSnapshot.val();
          const updates = {};
          let pointsUpdated = false;

          Object.entries(pointsData).forEach(([userId, userPoints]) => {
            if (userPoints && Array.isArray(userPoints)) {
              const updatedPoints = userPoints.filter(
                (point) => !point.postId || point.postId !== postId
              );
              if (updatedPoints.length !== userPoints.length) {
                updates[`points/${userId}`] = updatedPoints;
                pointsUpdated = true;
              }
            }
          });

          if (pointsUpdated) {
            await database.ref().update(updates);
            console.log("✅ Cleaned up points system references");
          }
        }
      } catch (error) {
        console.error("Error cleaning up points references:", error);
      }

      // Step 5: Finally, delete the original post itself
      await postRef.remove();
      console.log("✅ Original post deleted successfully");

      return res.status(200).json({
        message: "Original post and all references deleted successfully",
        postId: postId,
        deletedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error deleting post:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to delete post" });
  }
};

// ✅ NEW: Cleanup function to remove orphaned data
const cleanupOrphanedData = async (req, res) => {
  try {
    console.log("🧹 Starting orphaned data cleanup...");

    // Get all posts
    const postsSnapshot = await database.ref("posts").once("value");
    const postsData = postsSnapshot.val() || {};

    const updates = {};
    let cleanupCount = 0;

    // Check for reposts that reference non-existent original posts
    Object.entries(postsData).forEach(([id, post]) => {
      if (post.isRepost && post.originalPostId) {
        const originalPostExists = postsData[post.originalPostId];

        if (!originalPostExists) {
          console.log(
            `🧹 Found orphaned repost ${id} referencing non-existent post ${post.originalPostId}`
          );

          // Mark as orphaned
          updates[`posts/${id}/isOrphaned`] = true;
          updates[`posts/${id}/originalDeleted`] = true;
          updates[`posts/${id}/content`] = "[Original post no longer exists]";
          updates[`posts/${id}/originalPost`] = {
            id: post.originalPostId,
            author: "Unknown Author",
            content: "[Original post no longer exists]",
            isDeleted: true,
            deletedAt: new Date().toISOString(),
          };

          cleanupCount++;
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      await database.ref().update(updates);
      console.log(`✅ Cleaned up ${cleanupCount} orphaned reposts`);
    } else {
      console.log("✅ No orphaned data found");
    }

    return res.status(200).json({
      message: "Orphaned data cleanup completed",
      cleanedCount: cleanupCount,
    });
  } catch (error) {
    console.error("Error during cleanup:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to cleanup orphaned data" });
  }
};

module.exports = {
  getPosts,
  createPost,
  updatePost,
  deletePost,
  likePost,
  getComments,
  createComment,
  createReply,
  likeComment,
  likeReply,
  repostPost,
  unrepostPost,
  getRepostChain,
  getReposts, // ✅ NEW: Export the new getReposts function
  cleanupOrphanedData, // ✅ NEW: Export cleanup function
};
