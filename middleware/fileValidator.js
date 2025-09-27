const multer = require("multer");
const path = require("path");
const fs = require("fs");

/**
 * File validation middleware
 * Validates file types, sizes, and content
 */

// Allowed file types and their MIME types
const ALLOWED_FILE_TYPES = {
  image: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
  video: ["video/mp4", "video/webm", "video/ogg", "video/avi", "video/mov"],
  document: [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"],
};

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB
  video: 100 * 1024 * 1024, // 100MB
  document: 10 * 1024 * 1024, // 10MB
  audio: 20 * 1024 * 1024, // 20MB
  default: 20 * 1024 * 1024, // 20MB
};

/**
 * Get file type category based on MIME type
 */
const getFileCategory = (mimetype) => {
  for (const [category, types] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (types.includes(mimetype)) {
      return category;
    }
  }
  return "unknown";
};

/**
 * Validate file type
 */
const validateFileType = (file) => {
  const category = getFileCategory(file.mimetype);

  if (category === "unknown") {
    throw new Error(`File type ${file.mimetype} is not supported`);
  }

  return category;
};

/**
 * Validate file size
 */
const validateFileSize = (file, category) => {
  const maxSize = FILE_SIZE_LIMITS[category] || FILE_SIZE_LIMITS.default;

  if (file.size > maxSize) {
    const maxSizeMB = Math.round(maxSize / (1024 * 1024));
    throw new Error(`File size must be less than ${maxSizeMB}MB`);
  }
};

/**
 * Validate file extension matches MIME type
 */
const validateFileExtension = (file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const category = getFileCategory(file.mimetype);

  const extensionMap = {
    image: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
    video: [".mp4", ".webm", ".ogg", ".avi", ".mov"],
    document: [".pdf", ".txt", ".doc", ".docx"],
    audio: [".mp3", ".wav", ".ogg", ".mpeg"],
  };

  if (extensionMap[category] && !extensionMap[category].includes(ext)) {
    throw new Error(
      `File extension ${ext} does not match file type ${file.mimetype}`
    );
  }
};

/**
 * Check for malicious file content
 */
const validateFileContent = (file) => {
  // Check for executable file signatures
  const executableSignatures = [
    "4D5A", // PE executable
    "7F454C46", // ELF executable
    "CAFEBABE", // Java class file
    "504B0304", // ZIP/JAR file
  ];

  // Read first few bytes to check signature
  const buffer = fs.readFileSync(file.path, { start: 0, end: 4 });
  const hex = buffer.toString("hex").toUpperCase();

  if (executableSignatures.some((sig) => hex.startsWith(sig))) {
    throw new Error("File appears to be executable and is not allowed");
  }
};

/**
 * Main file validation function
 */
const validateFile = (file) => {
  try {
    // Validate file type
    const category = validateFileType(file);

    // Validate file size
    validateFileSize(file, category);

    // Validate file extension
    validateFileExtension(file);

    // Validate file content (for images and documents)
    if (["image", "document"].includes(category)) {
      validateFileContent(file);
    }

    return {
      valid: true,
      category,
      size: file.size,
      mimetype: file.mimetype,
      originalname: file.originalname,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
};

/**
 * Multer configuration with validation
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/temp";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  try {
    const validation = validateFile(file);

    if (validation.valid) {
      cb(null, true);
    } else {
      cb(new Error(validation.error), false);
    }
  } catch (error) {
    cb(error, false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: FILE_SIZE_LIMITS.default,
    files: 5, // Maximum 5 files per request
  },
});

/**
 * Middleware to handle file validation errors
 */
const handleFileValidationError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "File size exceeds the maximum allowed limit",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        error: "Too many files",
        message: "Maximum number of files exceeded",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: "Unexpected file field",
        message: "File field name not expected",
      });
    }
  }

  if (error.message) {
    return res.status(400).json({
      error: "File validation failed",
      message: error.message,
    });
  }

  next(error);
};

/**
 * Middleware to validate uploaded files
 */
const validateUploadedFiles = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }

  const validationResults = req.files.map((file) => validateFile(file));
  const invalidFiles = validationResults.filter((result) => !result.valid);

  if (invalidFiles.length > 0) {
    return res.status(400).json({
      error: "File validation failed",
      details: invalidFiles.map((f) => f.error),
    });
  }

  // Add validation results to request
  req.fileValidations = validationResults;
  next();
};

module.exports = {
  upload,
  validateFile,
  validateFileType,
  validateFileSize,
  validateFileExtension,
  validateFileContent,
  handleFileValidationError,
  validateUploadedFiles,
  ALLOWED_FILE_TYPES,
  FILE_SIZE_LIMITS,
};
