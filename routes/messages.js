const express = require("express");
const router = express.Router();
const { database } = require("../config/firebase");
const { authenticateToken } = require("../middleware/authMiddleware");

// Helper to check DM participation via userChats
async function isDmParticipant(uid, chatId) {
  try {
    const ref = database.ref(`userChats/${uid}/${chatId}`);
    const snap = await ref.once("value");
    return !!snap.val();
  } catch {
    return false;
  }
}

// Helper to check clan membership
async function isClanMember(uid, clanId) {
  try {
    const ref = database.ref(`clans/${clanId}/members/${uid}`);
    const snap = await ref.once("value");
    return !!snap.val();
  } catch {
    return false;
  }
}

// POST /api/messages/system
// Body: { chatId?, clanId?, content, systemType, gameTitle?, score? }
router.post("/system", authenticateToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { chatId, clanId, content, systemType, gameTitle, score } =
      req.body || {};

    if (!content || !systemType) {
      return res.status(400).json({ error: "Missing content or systemType" });
    }

    const now = Date.now();
    const payload = {
      system: true,
      systemType,
      senderId: uid,
      sender: req.user.name || req.user.email?.split("@")[0] || "System",
      username: req.user.name || req.user.email?.split("@")[0] || "System",
      senderAvatar: req.user.picture || "",
      gameTitle: gameTitle || null,
      score: typeof score === "number" ? score : null,
      content,
      createdAt: now,
    };

    let writes = 0;

    if (chatId) {
      const allowed = await isDmParticipant(uid, chatId);
      if (!allowed)
        return res.status(403).json({ error: "Not a participant of chat" });
      await database.ref(`directMessages/${chatId}/messages`).push(payload);
      writes++;
    }

    if (clanId) {
      const allowed = await isClanMember(uid, clanId);
      if (!allowed)
        return res.status(403).json({ error: "Not a member of clan" });
      await database
        .ref(`clans/${clanId}/messages`)
        .push({ ...payload, clanId });
      writes++;
    }

    if (!writes)
      return res.status(400).json({ error: "Provide chatId or clanId" });
    return res.json({ success: true });
  } catch (err) {
    console.error("/api/messages/system error:", err);
    return res.status(500).json({ error: "Failed to write system message" });
  }
});

module.exports = router;
