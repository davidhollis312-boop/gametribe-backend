const { database, storage } = require("../config/firebase");
const { v4: uuidv4 } = require("uuid");

const getClans = async (req, res) => {
  try {
    const clansRef = database.ref("clans");
    const snapshot = await clansRef.orderByChild("createdAt").once("value");
    const clansData = snapshot.val() || {};
    const clans = Object.entries(clansData).map(([id, data]) => ({
      id,
      ...data,
      members: Array.isArray(data.members) ? data.members : [],
      points: Array.isArray(data.points) ? data.points : [],
      createdAt: data.createdAt || new Date().toISOString(),
    }));
    clans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json(clans);
  } catch (error) {
    console.error("Error fetching clans:", error);
    return res.status(500).json({ error: "Failed to fetch clans" });
  }
};

const createClan = async (req, res) => {
  try {
    const { name, slogan } = req.body;
    if (!name || !slogan) {
      return res.status(400).json({ error: "Name and slogan are required" });
    }
    if (typeof name !== "string" || typeof slogan !== "string") {
      return res.status(400).json({ error: "Invalid name or slogan format" });
    }
    const userId = req.user.uid;
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

    let logoUrl = "https://via.placeholder.com/40";
    if (req.file) {
      const file = req.file;
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Logo must be an image" });
      }
      if (file.size > 5 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "Logo size must be less than 5MB" });
      }
      const fileName = `clans/${Date.now()}-${file.originalname}`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [logoUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const clanId = uuidv4();
    const newClan = {
      name: name.trim(),
      slogan: slogan.trim(),
      logo: logoUrl,
      adminId: userId,
      admin:
        userData.username ||
        (userData.email ? userData.email.split("@")[0] : "Unknown User"),
      members: [{ userId, joinedAt: new Date().toISOString() }],
      maxMembers: 50,
      isFull: false,
      points: [],
      createdAt: new Date().toISOString(),
    };
    await database.ref(`clans/${clanId}`).set(newClan);
    await userRef.update({
      clans: [...(userData.clans || []), clanId],
    });
    return res.status(201).json({ id: clanId, ...newClan });
  } catch (error) {
    console.error("Error creating clan:", error);
    return res.status(500).json({ error: "Failed to create clan" });
  }
};

const joinClan = async (req, res) => {
  try {
    const userId = req.user.uid;
    const clanId = req.params.id;
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clanData = clanSnapshot.val();
    if (!Array.isArray(clanData.members)) {
      clanData.members = [];
    }
    if (clanData.members.some((member) => member.userId === userId)) {
      return res.status(400).json({ error: "You are already a member" });
    }
    if (clanData.members.length >= (clanData.maxMembers || 50)) {
      return res.status(400).json({ error: "Clan is full" });
    }
    const newMembers = [
      ...clanData.members,
      { userId, joinedAt: new Date().toISOString() },
    ];
    await clanRef.update({
      members: newMembers,
      isFull: newMembers.length >= (clanData.maxMembers || 50),
    });
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userSnapshot.val();
    await userRef.update({
      clans: [...(userData.clans || []), clanId],
    });
    return res.status(200).json({ message: "Joined clan successfully" });
  } catch (error) {
    console.error("Error joining clan:", error);
    return res.status(500).json({ error: "Failed to join clan" });
  }
};

const leaveClan = async (req, res) => {
  try {
    const userId = req.user.uid;
    const clanId = req.params.id;

    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clan = clanSnapshot.val();

    if (
      !Array.isArray(clan.members) ||
      !clan.members.some((m) => m.userId === userId)
    ) {
      return res
        .status(400)
        .json({ error: "You are not a member of this clan" });
    }

    if (clan.adminId === userId) {
      return res
        .status(403)
        .json({ error: "Admin cannot leave their own clan" });
    }

    const updatedMembers = clan.members.filter((m) => m.userId !== userId);
    await clanRef.update({
      members: updatedMembers,
      isFull: updatedMembers.length >= (clan.maxMembers || 50),
    });

    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      const updatedClans = (userData.clans || []).filter(
        (cId) => cId !== clanId
      );
      await userRef.update({ clans: updatedClans });
    }

    return res.status(200).json({ message: "Left clan successfully" });
  } catch (error) {
    console.error("Error leaving clan:", error);
    return res.status(500).json({ error: "Failed to leave clan" });
  }
};

const getClanMembers = async (req, res) => {
  try {
    const userId = req.user.uid;
    const clanId = req.params.id;
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clanData = clanSnapshot.val();
    if (
      !Array.isArray(clanData.members) ||
      !clanData.members.some((member) => member.userId === userId)
    ) {
      return res
        .status(403)
        .json({ error: "You are not a member of this clan" });
    }
    const members = [];
    for (const member of clanData.members) {
      const userRef = database.ref(`users/${member.userId}`);
      const userSnapshot = await userRef.once("value");
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();

        // Validate user data structure
        if (!userData) {
          console.log("⚠️ User data is null for user:", member.userId);
          continue;
        }

        members.push({
          id: member.userId,
          username:
            userData.username ||
            (userData.email ? userData.email.split("@")[0] : "Unknown User"),
          avatar: userData.avatar || "https://via.placeholder.com/40",
          joinedAt: member.joinedAt,
          points: userData.points || 0,
          country: userData.country || "US",
        });
      }
    }
    return res
      .status(200)
      .json(
        members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))
      );
  } catch (error) {
    console.error("Error fetching clan members:", error);
    return res.status(500).json({ error: "Failed to fetch clan members" });
  }
};

const sendGroupMessage = async (req, res) => {
  try {
    const clanId = req.params.id;
    const userId = req.user.uid;
    const { content, uploadOnly } = req.body;

    // If uploadOnly flag is present, handle file upload only
    if (uploadOnly === "true") {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "File is required for upload only mode" });
      }

      const file = req.file;
      // Allow images, videos, audio, and documents
      const allowedTypes = [
        "image/",
        "video/",
        "audio/",
        "application/pdf",
        "text/",
        "application/",
      ];
      const isAllowedType = allowedTypes.some((type) =>
        file.mimetype.startsWith(type)
      );

      if (!isAllowedType) {
        return res.status(400).json({
          error:
            "Unsupported file type. Please upload images, videos, PDFs, or text files.",
        });
      }

      // Increase size limit for videos and audio; moderate for others
      const isVideo = file.mimetype.startsWith("video/");
      const isAudio = file.mimetype.startsWith("audio/");
      const maxSize = isVideo || isAudio ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for video/audio, 5MB others
      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        return res
          .status(400)
          .json({ error: `File size must be less than ${maxSizeMB}MB` });
      }

      const fileName = `clans/${clanId}/messages/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      const [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });

      return res.status(200).json({ attachment: attachmentUrl });
    }

    // For regular messages (not uploadOnly), validate clan membership
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clan = clanSnapshot.val();
    if (
      !Array.isArray(clan.members) ||
      !clan.members.some((member) => member.userId === userId)
    ) {
      return res
        .status(403)
        .json({ error: "You are not a member of this clan" });
    }
    if (!content && !req.file) {
      return res
        .status(400)
        .json({ error: "Content or attachment is required" });
    }
    let attachmentUrl = "";
    if (req.file) {
      const file = req.file;

      // Allow images, videos, audio, and documents (same as uploadOnly section)
      const allowedTypes = [
        "image/",
        "video/",
        "audio/",
        "application/pdf",
        "text/",
        "application/",
      ];
      const isAllowedType = allowedTypes.some((type) =>
        file.mimetype.startsWith(type)
      );

      if (!isAllowedType) {
        return res.status(400).json({
          error:
            "Unsupported file type. Please upload images, videos, PDFs, or text files.",
        });
      }

      // Increase size limit for videos and audio
      const isVideo2 = file.mimetype.startsWith("video/");
      const isAudio2 = file.mimetype.startsWith("audio/");
      const maxSize = isVideo2 || isAudio2 ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for video/audio, 5MB others
      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        return res
          .status(400)
          .json({ error: `File size must be less than ${maxSizeMB}MB` });
      }

      const fileName = `clans/${clanId}/messages/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const messagesRef = database.ref(`clans/${clanId}/messages`);
    const newMessageRef = messagesRef.push();
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val();
    const senderName =
      userData?.username || userData?.email.split("@")[0] || "Unknown";
    const senderAvatar = userData?.avatar || "https://via.placeholder.com/40";
    const message = {
      id: newMessageRef.key,
      senderId: userId,
      sender: senderName,
      senderAvatar,
      content: content || "",
      attachment: attachmentUrl,
      sentAt: Date.now(),
    };
    await newMessageRef.set(message);
    return res.status(201).json(message);
  } catch (error) {
    console.error("Error sending group message:", error);
    return res.status(500).json({ error: "Failed to send group message" });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const clanId = req.params.id;
    const userId = req.user.uid;
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clan = clanSnapshot.val();
    if (
      !Array.isArray(clan.members) ||
      !clan.members.some((member) => member.userId === userId)
    ) {
      return res
        .status(403)
        .json({ error: "You are not a member of this clan" });
    }
    return res.status(200).json({
      path: `clans/${clanId}/messages`,
      message: "Use Firebase Realtime Database to listen for messages",
    });
  } catch (error) {
    console.error("Error fetching group messages:", error);
    return res.status(500).json({ error: "Failed to fetch group messages" });
  }
};

const sendDirectMessage = async (req, res) => {
  try {
    const { recipientId, content, uploadOnly } = req.body;
    const senderId = req.user.uid;

    // If uploadOnly flag is present, handle file upload only
    if (uploadOnly === "true") {
      if (!req.file) {
        return res
          .status(400)
          .json({ error: "File is required for upload only mode" });
      }

      const file = req.file;
      // Allow images, videos, audio, and documents
      const allowedTypes = [
        "image/",
        "video/",
        "audio/",
        "application/pdf",
        "text/",
        "application/",
      ];
      const isAllowedType = allowedTypes.some((type) =>
        file.mimetype.startsWith(type)
      );

      if (!isAllowedType) {
        return res.status(400).json({
          error:
            "Unsupported file type. Please upload images, videos, PDFs, or text files.",
        });
      }

      // Increase size limit for videos and audio; moderate for others
      const isVideo = file.mimetype.startsWith("video/");
      const isAudio = file.mimetype.startsWith("audio/");
      const maxSize = isVideo || isAudio ? 50 * 1024 * 1024 : 5 * 1024 * 1024; // 50MB for video/audio, 5MB others
      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        return res
          .status(400)
          .json({ error: `File size must be less than ${maxSizeMB}MB` });
      }

      const chatId = [senderId, recipientId].sort().join("_");
      const fileName = `directMessages/${chatId}/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      const [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });

      return res.status(200).json({ attachment: attachmentUrl });
    }

    // For regular messages (not uploadOnly), validate required fields
    if (!recipientId) {
      return res.status(400).json({ error: "Recipient ID is required" });
    }
    if (!content && !req.file) {
      return res
        .status(400)
        .json({ error: "Content or attachment is required" });
    }
    let attachmentUrl = "";
    if (req.file) {
      const file = req.file;

      // Allow images, videos, and documents (same as uploadOnly section)
      const allowedTypes = [
        "image/",
        "video/",
        "application/pdf",
        "text/",
        "application/",
      ];
      const isAllowedType = allowedTypes.some((type) =>
        file.mimetype.startsWith(type)
      );

      if (!isAllowedType) {
        return res.status(400).json({
          error:
            "Unsupported file type. Please upload images, videos, PDFs, or text files.",
        });
      }

      // Increase size limit for videos and documents
      const maxSize = file.mimetype.startsWith("video/")
        ? 50 * 1024 * 1024
        : 5 * 1024 * 1024; // 50MB for videos, 5MB for others
      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        return res
          .status(400)
          .json({ error: `File size must be less than ${maxSizeMB}MB` });
      }

      const chatId = [senderId, recipientId].sort().join("_");
      const fileName = `directMessages/${chatId}/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const chatId = [senderId, recipientId].sort().join("_");
    const messagesRef = database.ref(`directMessages/${chatId}/messages`);
    const newMessageRef = messagesRef.push();
    const userRef = database.ref(`users/${senderId}`);
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val();
    const senderName =
      userData?.username || userData?.email.split("@")[0] || "Unknown";
    const senderAvatar = userData?.avatar || "https://via.placeholder.com/40";
    const message = {
      id: newMessageRef.key,
      senderId,
      sender: senderName,
      senderAvatar,
      content,
      attachment: attachmentUrl,
      sentAt: Date.now(),
    };
    await newMessageRef.set(message);
    return res.status(201).json(message);
  } catch (error) {
    console.error("Error sending direct message:", error);
    return res.status(500).json({ error: "Failed to send direct message" });
  }
};

const getDirectMessages = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const requestingUserId = req.user.uid;
    if (requestingUserId !== userId1 && requestingUserId !== userId2) {
      return res
        .status(403)
        .json({ error: "You are not authorized to view these messages" });
    }
    const chatId = [userId1, userId2].sort().join("_");
    return res.status(200).json({
      path: `directMessages/${chatId}/messages`,
      message: "Use Firebase Realtime Database to listen for messages",
    });
  } catch (error) {
    console.error("Error fetching direct messages:", error);
    return res.status(500).json({ error: "Failed to fetch direct messages" });
  }
};

const addClanPoints = async (req, res) => {
  try {
    const clanId = req.params.id;
    const { points } = req.body;
    if (!points || !Number.isInteger(points) || points <= 0) {
      return res.status(400).json({ error: "Valid points value is required" });
    }
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clan = clanSnapshot.val();
    if (clan.adminId !== req.user.uid) {
      return res.status(403).json({ error: "Only the admin can add points" });
    }
    await clanRef.update({
      points: [...(Array.isArray(clan.points) ? clan.points : []), points],
    });
    return res.status(200).json({ message: "Points added successfully" });
  } catch (error) {
    console.error("Error adding points:", error);
    return res.status(500).json({ error: "Failed to add points" });
  }
};

const updateOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const userId = req.user.uid;
    const presenceRef = database.ref(`presence/${userId}`);
    const status = {
      isOnline: isOnline || false,
      lastActive: Date.now(),
    };
    await presenceRef.set(status);
    await database.ref(`users/${userId}/onlineStatus`).set(status);
    return res.status(200).json({ message: "Online status updated" });
  } catch (error) {
    console.error("Error updating online status:", error);
    return res.status(500).json({ error: "Failed to update online status" });
  }
};

const getOnlineStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    return res.status(200).json({
      path: `presence/${userId}`,
      message: "Use Firebase Realtime Database to listen for online status",
    });
  } catch (error) {
    console.error("Error fetching online status:", error);
    return res.status(500).json({ error: "Failed to fetch online status" });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.uid;
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    if (!userSnapshot.exists()) {
      const newUser = {
        uid: userId,
        email: req.user.email,
        username: req.user.name || req.user.email.split("@")[0],
        avatar: req.user.picture || "https://via.placeholder.com/40",
        bio: "",
        createdAt: new Date().toISOString(),
        clans: [],
        friendsCount: 0,
        points: 0,
        wallet: { amount: 0, currency: "KES" },
        pointsConverted: false,
      };
      await userRef.set(newUser);
      return res.status(200).json(newUser);
    }
    return res.status(200).json(userSnapshot.val());
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
};

const syncPresence = async (req, res) => {
  try {
    const { userId, isOnline } = req.body;
    const currentUserId = req.user.uid;

    // Validate userId is a string
    if (!userId || typeof userId !== "string") {
      console.error(
        "Invalid userId in syncPresence (clans):",
        userId,
        typeof userId
      );
      return res.status(400).json({ error: "Invalid userId" });
    }

    if (userId !== currentUserId) {
      return res
        .status(403)
        .json({ error: "Unauthorized to sync presence for this user" });
    }

    // Ensure isOnline is a boolean
    const onlineStatus = Boolean(isOnline);

    console.log(
      "🔄 Syncing presence for user (clans):",
      userId,
      "isOnline:",
      onlineStatus
    );

    const presenceRef = database.ref(`presence/${userId}`);
    await presenceRef.set({
      isOnline: onlineStatus,
      lastActive: new Date().toISOString(),
    });
    await database.ref(`users/${userId}/onlineStatus`).set({
      isOnline: onlineStatus,
      lastActive: new Date().toISOString(),
    });
    return res.status(200).json({ message: "Presence synced" });
  } catch (error) {
    console.error("Error syncing presence:", error);
    return res.status(500).json({ error: "Failed to sync presence" });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const clanId = req.params.id;
    const userId = req.user.uid;
    const { content } = req.body;
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clan = clanSnapshot.val();

    console.log("🔍 Debug createAnnouncement:", {
      clanId,
      userId,
      clanMembers: clan.members,
      isArray: Array.isArray(clan.members),
      membersLength: clan.members?.length,
    });

    // Check if user is a member of the clan (not just admin)
    const isMember =
      Array.isArray(clan.members) &&
      clan.members.some((member) => member.userId === userId);

    console.log("🔍 Member check result:", {
      isMember,
      memberUserIds: clan.members?.map((m) => m.userId),
      userId,
    });

    if (!isMember) {
      console.log("❌ User is not a member of the clan");
      return res.status(403).json({
        error: "You must be a member of this clan to create announcements",
      });
    }

    console.log("✅ User is a member, proceeding with announcement creation");
    if (!content && !req.file) {
      return res
        .status(400)
        .json({ error: "Content or attachment is required" });
    }
    let attachmentUrl = "";
    if (req.file) {
      const file = req.file;
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Attachment must be an image" });
      }
      if (file.size > 5 * 1024 * 1024) {
        return res
          .status(400)
          .json({ error: "Attachment size must be less than 5MB" });
      }
      const fileName = `clans/${clanId}/announcements/${Date.now()}-${
        file.originalname
      }`;
      const fileRef = storage.bucket().file(fileName);
      await fileRef.save(file.buffer, { contentType: file.mimetype });
      [attachmentUrl] = await fileRef.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });
    }
    const announcementsRef = database.ref(`clans/${clanId}/announcements`);
    const newAnnouncementRef = announcementsRef.push();
    const userRef = database.ref(`users/${userId}`);
    const userSnapshot = await userRef.once("value");
    const userData = userSnapshot.val();
    const senderName =
      userData?.username || userData?.email.split("@")[0] || "Unknown";
    const senderAvatar = userData?.avatar || "https://via.placeholder.com/40";
    const announcement = {
      id: newAnnouncementRef.key,
      senderId: userId,
      sender: senderName,
      senderAvatar,
      content: content || "",
      attachment: attachmentUrl,
      createdAt: Date.now(),
    };
    await newAnnouncementRef.set(announcement);
    return res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    return res.status(500).json({ error: "Failed to create announcement" });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    const clanId = req.params.id;
    const userId = req.user.uid;
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clan = clanSnapshot.val();
    if (
      !Array.isArray(clan.members) ||
      !clan.members.some((member) => member.userId === userId)
    ) {
      return res
        .status(403)
        .json({ error: "You are not a member of this clan" });
    }
    return res.status(200).json({
      path: `clans/${clanId}/announcements`,
      message: "Use Firebase Realtime Database to listen for announcements",
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    return res.status(500).json({ error: "Failed to fetch announcements" });
  }
};

const getClanPublicMembers = async (req, res) => {
  try {
    const clanId = req.params.id;
    const clanRef = database.ref(`clans/${clanId}`);
    const clanSnapshot = await clanRef.once("value");
    if (!clanSnapshot.exists()) {
      return res.status(404).json({ error: "Clan not found" });
    }
    const clanData = clanSnapshot.val();
    if (!Array.isArray(clanData.members)) {
      return res.status(200).json([]);
    }
    const members = [];
    for (const member of clanData.members) {
      const userRef = database.ref(`users/${member.userId}`);
      const userSnapshot = await userRef.once("value");
      if (userSnapshot.exists()) {
        const userData = userSnapshot.val();

        // Validate user data structure
        if (!userData) {
          console.log("⚠️ User data is null for user:", member.userId);
          continue;
        }

        members.push({
          id: member.userId,
          username:
            userData.username ||
            (userData.email ? userData.email.split("@")[0] : "Unknown User"),
          avatar: userData.avatar || "https://via.placeholder.com/40",
          joinedAt: member.joinedAt,
          points: userData.points || 0,
          country: userData.country || "US",
        });
      }
    }
    return res
      .status(200)
      .json(
        members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))
      );
  } catch (error) {
    console.error("Error fetching public clan members:", error);
    return res.status(500).json({ error: "Failed to fetch clan members" });
  }
};

module.exports = {
  getClans,
  createClan,
  joinClan,
  leaveClan,
  getClanMembers,
  sendGroupMessage,
  getGroupMessages,
  sendDirectMessage,
  getDirectMessages,
  addClanPoints,
  updateOnlineStatus,
  getOnlineStatus,
  getUserProfile,
  syncPresence,
  createAnnouncement,
  getAnnouncements,
  getClanPublicMembers,
};
