const { database, storage } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");
const DOMPurify = require("dompurify");
const { JSDOM } = require("jsdom");
const window = new JSDOM("").window;
const purify = DOMPurify(window);
const { processPointsForAction } = require("./points");

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

const getPosts = async (req, res) => {
  try {
    const userId = req.user?.uid;
    const postsRef = database.ref("posts");
    const snapshot = await postsRef.orderByChild("createdAt").once("value");
    const postsData = snapshot.val() || {};
    const posts = Object.entries(postsData).map(([id, data]) => ({
      id,
      ...data,
      likes: data.likes || 0,
      likedBy: Array.isArray(data.likedBy) ? data.likedBy : [],
      liked:
        userId && Array.isArray(data.likedBy)
          ? data.likedBy.includes(userId)
          : false,
      repostCount: data.repostCount || 0,
      repostedBy: Array.isArray(data.repostedBy) ? data.repostedBy : [],
      reposted:
        userId && Array.isArray(data.repostedBy)
          ? data.repostedBy.includes(userId)
          : false,
    }));
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ posts });
  } catch (error) {
    console.error("Error fetching posts:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to fetch posts" });
  }
};

const createPost = async (req, res) => {
  try {
    const userId = req.user.uid;
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
    const sanitizedContent = sanitizeInput(content);
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();
    let imageUrl = sanitizeInput(imageLink) || "";
    if (req.file) {
      const file = req.file;
      if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Only image and video files are allowed" });
      }
      const fileName = `posts/${Date.now()}-${file.originalname}`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [imageUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const postId = uuidv4();
    const newPost = {
      authorId: userId,
      author: userData.username || userData.email.split("@")[0],
      authorImage: userData.avatar || "",
      content: sanitizedContent,
      category: sanitizeInput(category) || "",
      image: imageUrl,
      createdAt: new Date().toISOString(),
      comments: 0,
      likes: 0,
      likedBy: [],
      repostCount: 0,
      repostedBy: [],
      isRepost: false,
      originalPostId: null,
      originalPost: null,
    };
    await database.ref(`posts/${postId}`).set(newPost);
    
    // Add points for creating a post
    try {
      await processPointsForAction(userId, "POST_DISCUSSION", {
        postId,
        category: newPost.category,
      });
    } catch (pointsError) {
      console.error("Error adding points for post creation:", pointsError);
      // Don't fail the post creation if points fail
    }
    
    return res.status(201).json({ id: postId, ...newPost });
  } catch (error) {
    console.error("Error creating post:", error.message, error.stack);
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
    let attachmentUrl = "";
    if (req.file) {
      const file = req.file;
      if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Only image and video files are allowed" });
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
      author: userData.username || userData.email.split("@")[0],
      authorImage: userData.avatar || "",
      content: sanitizedContent,
      attachment: attachmentUrl,
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
    let attachmentUrl = "";
    if (req.file) {
      const file = req.file;
      if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
        return res.status(400).json({ error: "Only image and video files are allowed" });
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
      author: userData.username || userData.email.split("@")[0],
      authorImage: userData.avatar || "",
      content: sanitizedContent,
      attachment: attachmentUrl,
      likes: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };
    await database
      .ref(`posts/${postId}/comments/${commentId}/replies/${replyId}`)
      .set(reply);
    await postRef.update({ comments: (postSnapshot.val().comments || 0) + 1 });
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
    
    // Check if user already reposted this post
    if (originalPost.repostedBy && originalPost.repostedBy.includes(userId)) {
      return res.status(400).json({ error: "You have already reposted this post" });
    }

    // Get user data
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();

    // Create repost
    const repostId = uuidv4();
    const repostData = {
      authorId: userId,
      author: userData.username || userData.email.split("@")[0],
      authorImage: userData.avatar || "",
      content: comment || "", // Optional comment
      category: originalPost.category || "",
      image: "", // Reposts don't have their own media
      createdAt: new Date().toISOString(),
      comments: 0,
      likes: 0,
      likedBy: [],
      repostCount: 0,
      repostedBy: [],
      isRepost: true,
      originalPostId: postId,
      originalPost: {
        id: postId,
        author: originalPost.author,
        authorId: originalPost.authorId,
        content: originalPost.content,
        image: originalPost.image,
        category: originalPost.category,
        createdAt: originalPost.createdAt,
      },
    };

    // Save repost
    await database.ref(`posts/${repostId}`).set(repostData);

    // Update original post repost count and repostedBy array
    const newRepostedBy = [...(originalPost.repostedBy || []), userId];
    const newRepostCount = (originalPost.repostCount || 0) + 1;
    
    await originalPostRef.update({
      repostCount: newRepostCount,
      repostedBy: newRepostedBy,
    });

    // Add points for reposting
    try {
      await processPointsForAction(userId, "REPOST_POST", {
        postId: repostId,
        originalPostId: postId,
        category: originalPost.category,
      });
    } catch (pointsError) {
      console.warn("Failed to add points for repost:", pointsError);
    }

    return res.status(201).json({
      message: "Post reposted successfully",
      repostId,
      repostCount: newRepostCount,
    });
  } catch (error) {
    console.error("Error reposting post:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to repost post" });
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

    // Remove repost from original post
    const newRepostedBy = originalPost.repostedBy.filter(id => id !== userId);
    const newRepostCount = Math.max(0, (originalPost.repostCount || 0) - 1);
    
    await originalPostRef.update({
      repostCount: newRepostCount,
      repostedBy: newRepostedBy,
    });

    // Find and delete the repost
    const postsRef = database.ref("posts");
    const repostSnapshot = await postsRef.orderByChild("originalPostId").equalTo(postId).once("value");
    
    if (repostSnapshot.exists()) {
      const repostEntries = Object.entries(repostSnapshot.val());
      const userRepost = repostEntries.find(([_, repost]) => repost.authorId === userId);
      
      if (userRepost) {
        await database.ref(`posts/${userRepost[0]}`).remove();
      }
    }

    return res.status(200).json({
      message: "Repost removed successfully",
      repostCount: newRepostCount,
    });
  } catch (error) {
    console.error("Error removing repost:", error.message, error.stack);
    return res.status(500).json({ error: "Failed to remove repost" });
  }
};

module.exports = {
  getPosts,
  createPost,
  likePost,
  getComments,
  createComment,
  createReply,
  likeComment,
  likeReply,
  repostPost,
  unrepostPost,
};
