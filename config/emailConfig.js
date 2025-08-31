// Email Configuration
// Copy this to your .env file or set these environment variables

module.exports = {
  // Email service (gmail, outlook, etc.)
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
  
  // Your email address
  EMAIL_USER: process.env.EMAIL_USER || 'your-email@gmail.com',
  
  // Your email password or app password
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || 'your-app-password',
  
  // Instructions for Gmail setup:
  // 1. Go to Google Account settings (https://myaccount.google.com/)
  // 2. Enable 2-factor authentication if not already enabled
  // 3. Go to Security > 2-Step Verification > App passwords
  // 4. Generate an App Password for "Mail"
  // 5. Use that password in EMAIL_PASSWORD
  
  // Instructions for other email providers:
  // - Outlook/Hotmail: Use your regular password
  // - Yahoo: Generate an app-specific password
  // - Custom SMTP: Set EMAIL_SERVICE to 'smtp' and add SMTP_HOST, SMTP_PORT
  
  // Example .env file content:
  // EMAIL_SERVICE=gmail
  // EMAIL_USER=your-email@gmail.com
  // EMAIL_PASSWORD=abcd efgh ijkl mnop
}; 