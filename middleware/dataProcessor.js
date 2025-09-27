/**
 * Data Processing Middleware
 * Handles data filtering, processing, and transformation on the backend
 */

/**
 * Process and sanitize user data
 */
const processUserData = (userData) => {
  if (!userData || typeof userData !== "object") {
    return null;
  }

  // Remove sensitive fields
  const sensitiveFields = [
    "password",
    "privateKey",
    "secret",
    "token",
    "refreshToken",
  ];
  const processed = { ...userData };

  sensitiveFields.forEach((field) => {
    delete processed[field];
  });

  // Ensure required fields have defaults
  return {
    uid: processed.uid || null,
    username: processed.username || processed.displayName || "Unknown",
    displayName: processed.displayName || processed.username || "Unknown",
    email: processed.email || null,
    photoURL: processed.photoURL || processed.avatar || null,
    country: processed.country || "US",
    points: processed.points || 0,
    isOnline: processed.isOnline || false,
    lastActive: processed.lastActive || null,
    createdAt: processed.createdAt || null,
    updatedAt: processed.updatedAt || Date.now(),
  };
};

/**
 * Process and sanitize post data
 */
const processPostData = (postData) => {
  if (!postData || typeof postData !== "object") {
    return null;
  }

  return {
    id: postData.id || null,
    content: postData.content || "",
    authorId: postData.authorId || null,
    author: postData.author || "Unknown",
    authorAvatar: postData.authorAvatar || null,
    category: postData.category || "general",
    clanId: postData.clanId || null,
    imageUrl: postData.imageUrl || null,
    videoUrl: postData.videoUrl || null,
    attachment: postData.attachment || null,
    attachmentType: postData.attachmentType || null,
    attachmentName: postData.attachmentName || null,
    likes: postData.likes || 0,
    likedBy: Array.isArray(postData.likedBy) ? postData.likedBy : [],
    comments: postData.comments || 0,
    reposts: postData.reposts || 0,
    repostedBy: Array.isArray(postData.repostedBy) ? postData.repostedBy : [],
    repostChain: postData.repostChain || null,
    isRepost: postData.isRepost || false,
    originalPostId: postData.originalPostId || null,
    createdAt: postData.createdAt || Date.now(),
    updatedAt: postData.updatedAt || Date.now(),
  };
};

/**
 * Process and sanitize event data
 */
const processEventData = (eventData) => {
  if (!eventData || typeof eventData !== "object") {
    return null;
  }

  return {
    id: eventData.id || null,
    title: eventData.title || "Untitled Event",
    description: eventData.description || "",
    organizerId: eventData.organizerId || null,
    organizer: eventData.organizer || "Unknown",
    organizerAvatar: eventData.organizerAvatar || null,
    date: eventData.date || null,
    time: eventData.time || null,
    location: eventData.location || null,
    address: eventData.address || null,
    coordinates: eventData.coordinates || null,
    imageUrl: eventData.imageUrl || null,
    maxAttendees: eventData.maxAttendees || null,
    attendees: Array.isArray(eventData.attendees) ? eventData.attendees : [],
    attendeesCount: eventData.attendeesCount || 0,
    likes: eventData.likes || 0,
    likedBy: Array.isArray(eventData.likedBy) ? eventData.likedBy : [],
    comments: eventData.comments || 0,
    isPublic: eventData.isPublic !== false,
    status: eventData.status || "active",
    createdAt: eventData.createdAt || Date.now(),
    updatedAt: eventData.updatedAt || Date.now(),
  };
};

/**
 * Process and sanitize chat data
 */
const processChatData = (chatData) => {
  if (!chatData || typeof chatData !== "object") {
    return null;
  }

  return {
    id: chatData.id || null,
    content: chatData.content || "",
    senderId: chatData.senderId || null,
    sender: chatData.sender || "Unknown",
    senderAvatar: chatData.senderAvatar || null,
    receiverId: chatData.receiverId || null,
    chatId: chatData.chatId || null,
    chatType: chatData.chatType || "direct",
    attachment: chatData.attachment || null,
    attachmentType: chatData.attachmentType || null,
    attachmentName: chatData.attachmentName || null,
    readBy: Array.isArray(chatData.readBy) ? chatData.readBy : [],
    sentAt: chatData.sentAt || Date.now(),
    editedAt: chatData.editedAt || null,
    deletedAt: chatData.deletedAt || null,
  };
};

/**
 * Process and sanitize clan data
 */
const processClanData = (clanData) => {
  if (!clanData || typeof clanData !== "object") {
    return null;
  }

  return {
    id: clanData.id || null,
    name: clanData.name || "Unnamed Clan",
    slogan: clanData.slogan || "",
    description: clanData.description || "",
    logo: clanData.logo || null,
    adminId: clanData.adminId || null,
    admin: clanData.admin || "Unknown",
    members: clanData.members || {},
    membersCount: clanData.membersCount || 0,
    points: clanData.points || 0,
    level: clanData.level || 1,
    isPublic: clanData.isPublic !== false,
    maxMembers: clanData.maxMembers || 50,
    createdAt: clanData.createdAt || Date.now(),
    updatedAt: clanData.updatedAt || Date.now(),
  };
};

/**
 * Filter and process user list
 */
const processUserList = (users, filters = {}) => {
  if (!users || typeof users !== "object") {
    return [];
  }

  let processedUsers = Object.entries(users)
    .map(([userId, userData]) => ({
      userId,
      ...processUserData(userData),
    }))
    .filter((user) => user.uid !== null);

  // Apply filters
  if (filters.country && filters.country !== "all") {
    processedUsers = processedUsers.filter(
      (user) => user.country === filters.country
    );
  }

  if (filters.isOnline !== undefined) {
    processedUsers = processedUsers.filter(
      (user) => user.isOnline === filters.isOnline
    );
  }

  if (filters.minPoints !== undefined) {
    processedUsers = processedUsers.filter(
      (user) => user.points >= filters.minPoints
    );
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    processedUsers = processedUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(searchTerm) ||
        user.displayName.toLowerCase().includes(searchTerm)
    );
  }

  // Sort
  const sortBy = filters.sortBy || "points";
  const sortOrder = filters.sortOrder || "desc";

  processedUsers.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (typeof aVal === "string") {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortOrder === "desc") {
      return bVal > aVal ? 1 : -1;
    } else {
      return aVal > bVal ? 1 : -1;
    }
  });

  // Pagination
  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  return processedUsers.slice(offset, offset + limit);
};

/**
 * Filter and process post list
 */
const processPostList = (posts, filters = {}) => {
  if (!posts || typeof posts !== "object") {
    return [];
  }

  let processedPosts = Object.entries(posts)
    .map(([postId, postData]) => ({
      id: postId,
      ...processPostData(postData),
    }))
    .filter((post) => post.id !== null);

  // Apply filters
  if (filters.category && filters.category !== "all") {
    processedPosts = processedPosts.filter(
      (post) => post.category === filters.category
    );
  }

  if (filters.authorId) {
    processedPosts = processedPosts.filter(
      (post) => post.authorId === filters.authorId
    );
  }

  if (filters.clanId) {
    processedPosts = processedPosts.filter(
      (post) => post.clanId === filters.clanId
    );
  }

  if (filters.hasMedia) {
    processedPosts = processedPosts.filter(
      (post) => post.imageUrl || post.videoUrl || post.attachment
    );
  }

  if (filters.isRepost !== undefined) {
    processedPosts = processedPosts.filter(
      (post) => post.isRepost === filters.isRepost
    );
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    processedPosts = processedPosts.filter(
      (post) =>
        post.content.toLowerCase().includes(searchTerm) ||
        post.author.toLowerCase().includes(searchTerm)
    );
  }

  // Sort
  const sortBy = filters.sortBy || "createdAt";
  const sortOrder = filters.sortOrder || "desc";

  processedPosts.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortOrder === "desc") {
      return bVal > aVal ? 1 : -1;
    } else {
      return aVal > bVal ? 1 : -1;
    }
  });

  // Pagination
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  return processedPosts.slice(offset, offset + limit);
};

/**
 * Filter and process event list
 */
const processEventList = (events, filters = {}) => {
  if (!events || typeof events !== "object") {
    return [];
  }

  let processedEvents = Object.entries(events)
    .map(([eventId, eventData]) => ({
      id: eventId,
      ...processEventData(eventData),
    }))
    .filter((event) => event.id !== null);

  // Apply filters
  if (filters.organizerId) {
    processedEvents = processedEvents.filter(
      (event) => event.organizerId === filters.organizerId
    );
  }

  if (filters.status && filters.status !== "all") {
    processedEvents = processedEvents.filter(
      (event) => event.status === filters.status
    );
  }

  if (filters.isPublic !== undefined) {
    processedEvents = processedEvents.filter(
      (event) => event.isPublic === filters.isPublic
    );
  }

  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    processedEvents = processedEvents.filter(
      (event) => new Date(event.date) >= fromDate
    );
  }

  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    processedEvents = processedEvents.filter(
      (event) => new Date(event.date) <= toDate
    );
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    processedEvents = processedEvents.filter(
      (event) =>
        event.title.toLowerCase().includes(searchTerm) ||
        event.description.toLowerCase().includes(searchTerm) ||
        event.location.toLowerCase().includes(searchTerm)
    );
  }

  // Sort
  const sortBy = filters.sortBy || "date";
  const sortOrder = filters.sortOrder || "asc";

  processedEvents.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    if (sortOrder === "desc") {
      return bVal > aVal ? 1 : -1;
    } else {
      return aVal > bVal ? 1 : -1;
    }
  });

  // Pagination
  const limit = filters.limit || 20;
  const offset = filters.offset || 0;

  return processedEvents.slice(offset, offset + limit);
};

/**
 * Process friend list data
 */
const processFriendList = (friends, userId) => {
  if (!friends || typeof friends !== "object") {
    return [];
  }

  // Handle different data structures
  let friendIds = [];
  if (Array.isArray(friends)) {
    friendIds = friends.filter((uid) => uid && typeof uid === "string");
  } else if (typeof friends === "object") {
    friendIds = Object.keys(friends);
  }

  return friendIds.filter((friendId) => friendId !== userId);
};

/**
 * Process clan member list
 */
const processClanMemberList = (members, clanData) => {
  if (!members || typeof members !== "object") {
    return [];
  }

  return Object.entries(members)
    .map(([memberId, memberData]) => ({
      id: memberId,
      username: memberData.username || "Unknown",
      displayName: memberData.displayName || memberData.username || "Unknown",
      avatar: memberData.avatar || memberData.photoURL || null,
      role: memberData.role || "member",
      joinedAt: memberData.joinedAt || Date.now(),
      isAdmin: memberId === clanData.adminId,
      points: memberData.points || 0,
    }))
    .sort((a, b) => {
      // Admins first, then by points
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return b.points - a.points;
    });
};

/**
 * Middleware to process request data
 */
const processRequestData = (req, res, next) => {
  try {
    // Process user data if present
    if (req.body.userData) {
      req.body.userData = processUserData(req.body.userData);
    }

    // Process post data if present
    if (req.body.postData) {
      req.body.postData = processPostData(req.body.postData);
    }

    // Process event data if present
    if (req.body.eventData) {
      req.body.eventData = processEventData(req.body.eventData);
    }

    // Process chat data if present
    if (req.body.chatData) {
      req.body.chatData = processChatData(req.body.chatData);
    }

    // Process clan data if present
    if (req.body.clanData) {
      req.body.clanData = processClanData(req.body.clanData);
    }

    next();
  } catch (error) {
    console.error("Data processing error:", error);
    res.status(400).json({
      error: "Data processing failed",
      message: error.message,
    });
  }
};

module.exports = {
  processUserData,
  processPostData,
  processEventData,
  processChatData,
  processClanData,
  processUserList,
  processPostList,
  processEventList,
  processFriendList,
  processClanMemberList,
  processRequestData,
};
