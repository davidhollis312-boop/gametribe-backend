const { createTransporter, emailTemplates } = require('../config/email');
const database = require('../config/firebase');

class EmailService {
  constructor() {
    this.transporter = createTransporter();
  }

  // Send booking confirmation email
  async sendBookingConfirmation(bookerId, eventId) {
    try {
      // Get booker details
      const bookerSnapshot = await database.ref(`users/${bookerId}`).once('value');
      const booker = bookerSnapshot.val();
      
      if (!booker) {
        throw new Error('Booker not found');
      }

      // Get event details
      const eventSnapshot = await database.ref(`events/${eventId}`).once('value');
      const event = eventSnapshot.val();
      
      if (!event) {
        throw new Error('Event not found');
      }

      const emailContent = emailTemplates.bookingConfirmation(
        booker.displayName || booker.email?.split('@')[0] || 'User',
        event.title,
        new Date(event.startDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        event.location || null
      );

      const mailOptions = {
        from: `"GameTribe Community" <${process.env.EMAIL_USER}>`,
        to: booker.email,
        subject: `🎉 Booking Confirmed: ${event.title}`,
        html: emailContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Booking confirmation email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Error sending booking confirmation email:', error);
      throw error;
    }
  }

  // Send contact message email
  async sendContactMessage(fromUserId, toUserId, eventId, subject, message, attachments = []) {
    try {
      // Get sender details
      const fromUserSnapshot = await database.ref(`users/${fromUserId}`).once('value');
      const fromUser = fromUserSnapshot.val();
      
      if (!fromUser) {
        throw new Error('Sender not found');
      }

      // Get recipient details
      const toUserSnapshot = await database.ref(`users/${toUserId}`).once('value');
      const toUser = toUserSnapshot.val();
      
      if (!toUser) {
        throw new Error('Recipient not found');
      }

      // Get event details if provided
      let eventTitle = null;
      let isEventOrganizer = false;
      
      if (eventId) {
        const eventSnapshot = await database.ref(`events/${eventId}`).once('value');
        const event = eventSnapshot.val();
        if (event) {
          eventTitle = event.title;
          isEventOrganizer = event.authorId === toUserId;
        }
      }

      const emailContent = emailTemplates.contactEmail(
        fromUser.displayName || fromUser.email?.split('@')[0] || 'User',
        fromUser.email,
        subject,
        message,
        eventTitle,
        isEventOrganizer
      );

      const mailOptions = {
        from: `"GameTribe Community" <${process.env.EMAIL_USER}>`,
        to: toUser.email,
        subject: `📧 ${subject}`,
        html: emailContent,
        replyTo: fromUser.email // Allow direct reply to sender
      };

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map(attachment => ({
          filename: attachment.originalname,
          content: attachment.buffer,
          contentType: attachment.mimetype
        }));
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Contact message email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Error sending contact message email:', error);
      throw error;
    }
  }

  // Verify email configuration
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return false;
    }
  }
}

module.exports = new EmailService(); 