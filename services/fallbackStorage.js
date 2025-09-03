// Fallback storage service for when Firebase Storage is not available
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class FallbackStorage {
  constructor() {
    this.uploadDir = path.join(__dirname, '../uploads');
    this.baseUrl = process.env.FALLBACK_STORAGE_URL || 'http://localhost:3000/uploads';
    
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  // Upload file to local filesystem
  async uploadFile(file, destination) {
    try {
      const fileName = `${uuidv4()}-${file.originalname}`;
      const filePath = path.join(this.uploadDir, fileName);
      
      // Save file to local filesystem
      fs.writeFileSync(filePath, file.buffer);
      
      console.log(`📁 File saved locally: ${fileName}`);
      
      return {
        name: fileName,
        path: filePath,
        url: `${this.baseUrl}/${fileName}`,
        size: file.size,
        mimetype: file.mimetype
      };
    } catch (error) {
      console.error('❌ Fallback storage upload failed:', error.message);
      throw error;
    }
  }

  // Delete file from local filesystem
  async deleteFile(fileName) {
    try {
      const filePath = path.join(this.uploadDir, fileName);
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted local file: ${fileName}`);
      } else {
        console.log(`ℹ️ Local file not found: ${fileName}`);
      }
    } catch (error) {
      console.error('❌ Fallback storage deletion failed:', error.message);
      // Don't throw error for deletion failures
    }
  }

  // Get file URL (for local files, return the local URL)
  async getSignedUrl(fileName, options = {}) {
    try {
      const filePath = path.join(this.uploadDir, fileName);
      
      if (fs.existsSync(filePath)) {
        return `${this.baseUrl}/${fileName}`;
      } else {
        throw new Error(`File not found: ${fileName}`);
      }
    } catch (error) {
      console.error('❌ Fallback storage URL generation failed:', error.message);
      throw error;
    }
  }

  // Check if file exists
  async fileExists(fileName) {
    const filePath = path.join(this.uploadDir, fileName);
    return fs.existsSync(filePath);
  }

  // Get file metadata
  async getFileMetadata(fileName) {
    try {
      const filePath = path.join(this.uploadDir, fileName);
      
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return {
          name: fileName,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      } else {
        throw new Error(`File not found: ${fileName}`);
      }
    } catch (error) {
      console.error('❌ Fallback storage metadata failed:', error.message);
      throw error;
    }
  }
}

module.exports = FallbackStorage;