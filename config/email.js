const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

// Email templates
const emailTemplates = {
  // Booking confirmation email
  bookingConfirmation: (userName, eventTitle, eventDate, eventLocation) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .content { padding: 40px 20px; }
        .success-icon { font-size: 48px; margin-bottom: 20px; }
        .event-details { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .event-details h3 { margin: 0 0 15px 0; color: #333; }
        .event-details p { margin: 5px 0; color: #666; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
          <p>You're all set for an amazing event!</p>
        </div>
        
        <div class="content">
          <div style="text-align: center;">
            <div class="success-icon">✅</div>
            <h2 style="color: #333; margin-bottom: 10px;">Hello ${userName}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Your event booking has been confirmed successfully. We're excited to have you join us!
            </p>
          </div>
          
          <div class="event-details">
            <h3>Event Details</h3>
            <p><strong>Event:</strong> ${eventTitle}</p>
            <p><strong>Date:</strong> ${eventDate}</p>
            ${eventLocation ? `<p><strong>Location:</strong> ${eventLocation}</p>` : ''}
          </div>
          
          <div style="text-align: center;">
            <p style="color: #666; margin-bottom: 20px;">
              Please save this confirmation email. You may need it for check-in at the event.
            </p>
            <a href="#" class="button">View Event Details</a>
          </div>
          
          <div style="margin-top: 30px; padding: 20px; background-color: #e8f4fd; border-radius: 8px; border-left: 4px solid #2196f3;">
            <h4 style="margin: 0 0 10px 0; color: #1976d2;">📋 What's Next?</h4>
            <ul style="margin: 0; padding-left: 20px; color: #1976d2;">
              <li>Mark your calendar for the event date</li>
              <li>Check your email for any updates from the organizer</li>
              <li>Prepare any items you might need for the event</li>
            </ul>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for using GameTribe Community!</p>
          <p>If you have any questions, please contact the event organizer.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  // Contact email template
  contactEmail: (fromName, fromEmail, subject, message, eventTitle, isEventOrganizer) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contact Message</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 300; }
        .content { padding: 30px 20px; }
        .message-box { background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
        .sender-info { background-color: #e8f4fd; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📧 New Contact Message</h1>
          <p>${isEventOrganizer ? 'From an event attendee' : 'From an event organizer'}</p>
        </div>
        
        <div class="content">
          <div class="sender-info">
            <h3 style="margin: 0 0 10px 0; color: #1976d2;">Sender Information</h3>
            <p style="margin: 5px 0; color: #333;"><strong>Name:</strong> ${fromName}</p>
            <p style="margin: 5px 0; color: #333;"><strong>Email:</strong> ${fromEmail}</p>
            ${eventTitle ? `<p style="margin: 5px 0; color: #333;"><strong>Event:</strong> ${eventTitle}</p>` : ''}
          </div>
          
          <div class="message-box">
            <h3 style="margin: 0 0 15px 0; color: #333;">Message</h3>
            <p style="margin: 0; color: #666; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Note:</strong> This message was sent through the GameTribe Community platform. 
              Please respond directly to ${fromEmail} if you wish to continue the conversation.
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p>GameTribe Community - Connecting gamers worldwide</p>
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
};

module.exports = {
  createTransporter,
  emailTemplates
}; 