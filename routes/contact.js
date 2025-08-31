const express = require('express');
const multer = require('multer');
const authenticate = require('../middleware/auth');
const {
  contactEventOrganizer,
  contactEventBooker,
  getContactHistory
} = require('../controllers/contact');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and common document formats
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'), false);
    }
  }
});

// Contact event organizer (for users who booked an event)
router.post('/event-organizer', authenticate, upload.array('attachments', 5), contactEventOrganizer);

// Contact event booker (for event organizers)
router.post('/event-booker', authenticate, upload.array('attachments', 5), contactEventBooker);

// Get contact history
router.get('/history', authenticate, getContactHistory);

// Test email service
router.get('/test', async (req, res) => {
  try {
    const emailService = require('../services/emailService');
    const result = await emailService.verifyConnection();
    res.json({ 
      message: 'Email service test', 
      connection: result ? 'successful' : 'failed' 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Email service test failed', 
      details: error.message 
    });
  }
});

module.exports = router; 