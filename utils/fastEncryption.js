const crypto = require("crypto");

/**
 * Fast Encryption utilities - Optimized for performance
 * Uses AES-256-GCM (faster than CBC) with reduced PBKDF2 iterations
 */

const ALGORITHM = "aes-256-gcm"; // GCM is faster than CBC
const IV_LENGTH = 12; // GCM uses 12-byte IV (faster than 16-byte CBC)
const SALT_LENGTH = 32; // Reduced from 64 for faster key generation
const TAG_LENGTH = 16; // GCM authentication tag length

/**
 * Generate encryption key with reduced iterations for speed
 */
const generateKey = (password, salt) => {
  // Reduced from 100,000 to 10,000 iterations for 10x speed improvement
  return crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");
};

/**
 * Fast encrypt data using AES-256-GCM
 */
const encryptDataFast = (data, password) => {
  try {
    if (!password || password.length !== 32) {
      throw new Error(
        `Encryption key must be exactly 32 characters, got ${
          password ? password.length : 0
        }`
      );
    }

    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate key
    const key = generateKey(password, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const dataString = JSON.stringify(data);
    let encrypted = cipher.update(dataString, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Combine components
    const encryptedData = {
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
      data: encrypted,
      timestamp: Date.now(),
    };

    return encryptedData;
  } catch (error) {
    console.error("Fast encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Fast decrypt data using AES-256-GCM
 */
const decryptDataFast = (encryptedData, password) => {
  try {
    if (!password || password.length !== 32) {
      throw new Error(
        `Decryption key must be exactly 32 characters, got ${
          password ? password.length : 0
        }`
      );
    }

    if (typeof encryptedData === "string") {
      encryptedData = JSON.parse(encryptedData);
    }

    if (!encryptedData || typeof encryptedData !== "object") {
      throw new Error("Invalid encrypted data format");
    }

    if (
      !encryptedData.salt ||
      !encryptedData.iv ||
      !encryptedData.data ||
      !encryptedData.tag
    ) {
      throw new Error("Missing required encryption fields");
    }

    // Extract components
    const salt = Buffer.from(encryptedData.salt, "hex");
    const iv = Buffer.from(encryptedData.iv, "hex");
    const tag = Buffer.from(encryptedData.tag, "hex");
    const encrypted = encryptedData.data;

    // Generate key
    const key = generateKey(password, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    // Decrypt data
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Fast decryption error:", error);
    throw new Error(`Failed to decrypt data: ${error.message}`);
  }
};

module.exports = {
  encryptDataFast,
  decryptDataFast,
  generateKey,
};
