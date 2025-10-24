const crypto = require("crypto");

// Use faster encryption algorithm (AES-256-CBC instead of AES-256-GCM)
const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits

/**
 * Fast encryption using AES-256-CBC (faster than GCM)
 * @param {string} text - Text to encrypt
 * @param {string} key - Encryption key
 * @returns {string} - Encrypted data (base64)
 */
function fastEncrypt(text, key) {
  try {
    // Derive key from input
    const derivedKey = crypto.scryptSync(key, "salt", KEY_LENGTH);

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipher(ALGORITHM, derivedKey);

    // Encrypt
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Combine IV and encrypted data
    const combined = iv.toString("hex") + ":" + encrypted;

    return Buffer.from(combined).toString("base64");
  } catch (error) {
    console.error("Fast encryption error:", error);
    throw new Error("Encryption failed");
  }
}

/**
 * Fast decryption using AES-256-CBC
 * @param {string} encryptedData - Encrypted data (base64)
 * @param {string} key - Decryption key
 * @returns {string} - Decrypted text
 */
function fastDecrypt(encryptedData, key) {
  try {
    // Decode from base64
    const combined = Buffer.from(encryptedData, "base64").toString("utf8");

    // Split IV and encrypted data
    const [ivHex, encrypted] = combined.split(":");
    const iv = Buffer.from(ivHex, "hex");

    // Derive key from input
    const derivedKey = crypto.scryptSync(key, "salt", KEY_LENGTH);

    // Create decipher
    const decipher = crypto.createDecipher(ALGORITHM, derivedKey);

    // Decrypt
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Fast decryption error:", error);
    throw new Error("Decryption failed");
  }
}

/**
 * Ultra-fast encryption for small data (challenge metadata)
 * Uses AES-128-ECB for maximum speed (less secure but faster)
 * @param {string} text - Text to encrypt
 * @param {string} key - Encryption key
 * @returns {string} - Encrypted data (base64)
 */
function ultraFastEncrypt(text, key) {
  try {
    // Use shorter key for speed
    const shortKey = crypto.scryptSync(key, "salt", 16); // 128 bits

    const cipher = crypto.createCipher("aes-128-ecb", shortKey);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return Buffer.from(encrypted).toString("base64");
  } catch (error) {
    console.error("Ultra-fast encryption error:", error);
    throw new Error("Ultra-fast encryption failed");
  }
}

/**
 * Ultra-fast decryption for small data
 * @param {string} encryptedData - Encrypted data (base64)
 * @param {string} key - Decryption key
 * @returns {string} - Decrypted text
 */
function ultraFastDecrypt(encryptedData, key) {
  try {
    const encrypted = Buffer.from(encryptedData, "base64").toString("hex");
    const shortKey = crypto.scryptSync(key, "salt", 16); // 128 bits

    const decipher = crypto.createDecipher("aes-128-ecb", shortKey);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Ultra-fast decryption error:", error);
    throw new Error("Ultra-fast decryption failed");
  }
}

module.exports = {
  fastEncrypt,
  fastDecrypt,
  ultraFastEncrypt,
  ultraFastDecrypt,
};
