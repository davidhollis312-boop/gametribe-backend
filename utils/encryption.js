const crypto = require("crypto");

/**
 * Encryption utilities for secure challenge data
 */

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // For CBC, this is always 16
const SALT_LENGTH = 64;

/**
 * Generate a secure challenge ID
 */
const generateChallengeId = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Generate encryption key from password using PBKDF2
 */
const generateKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha512");
};

/**
 * Encrypt data using AES-256-CBC
 */
const encryptData = (data, password) => {
  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);

    // Generate key from password and salt
    const key = generateKey(password, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const dataString = JSON.stringify(data);
    let encrypted = cipher.update(dataString, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Combine salt, iv, and encrypted data
    const encryptedData = {
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      data: encrypted,
      timestamp: Date.now(),
    };

    return encryptedData;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

/**
 * Decrypt data using AES-256-CBC
 */
const decryptData = (encryptedData, password) => {
  try {
    if (typeof encryptedData === "string") {
      encryptedData = JSON.parse(encryptedData);
    }

    // Extract components
    const salt = Buffer.from(encryptedData.salt, "hex");
    const iv = Buffer.from(encryptedData.iv, "hex");
    const encrypted = encryptedData.data;

    // Generate key from password and salt
    const key = generateKey(password, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Decrypt data
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
};

/**
 * Hash sensitive data (like user IDs) for logging
 */
const hashSensitiveData = (data) => {
  const hash = crypto.createHash("sha256");
  hash.update(data + process.env.HASH_SALT || "default-salt");
  return hash.digest("hex").substring(0, 16);
};

/**
 * Generate secure random token
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Verify data integrity
 */
const verifyDataIntegrity = (data, signature, secret) => {
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(data))
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    return false;
  }
};

/**
 * Create data signature
 */
const createDataSignature = (data, secret) => {
  return crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(data))
    .digest("hex");
};

module.exports = {
  generateChallengeId,
  encryptData,
  decryptData,
  hashSensitiveData,
  generateSecureToken,
  verifyDataIntegrity,
  createDataSignature,
};
