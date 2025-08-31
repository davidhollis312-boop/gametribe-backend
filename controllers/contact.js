const emailService = require('../services/emailService');
const database = require('../config/firebase');

// Send contact message to event organizer
const contactEventOrganizer = async (req, res) => {
  try {
    const { eventId, subject, message } = req.body;
    const fromUserId = req.user.uid;
    
    if (!eventId || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get event details
    const eventSnapshot = await database.ref(`events/${eventId}`).once('value');
    const event = eventSnapshot.val();
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const organizerId = event.authorId;
    
    // Don't allow contacting yourself
    if (fromUserId === organizerId) {
      return res.status(400).json({ error: 'Cannot contact yourself' });
    }

    // Get attachments from multer
    const attachments = req.files || [];

    // Send email
    await emailService.sendContactMessage(
      fromUserId,
      organizerId,
      eventId,
      subject,
      message,
      attachments
    );

    // Log the contact attempt
    const contactLog = {
      fromUserId,
      toUserId: organizerId,
      eventId,
      subject,
      message,
      timestamp: Date.now(),
      hasAttachments: attachments.length > 0
    };

    await database.ref('contactLogs').push(contactLog);

    res.status(200).json({ 
      message: 'Contact message sent successfully',
      contactId: contactLog.timestamp
    });

  } catch (error) {
    console.error('Error contacting event organizer:', error);
    res.status(500).json({ error: 'Failed to send contact message' });
  }
};

// Send contact message to event booker
const contactEventBooker = async (req, res) => {
  try {
    const { eventId, bookerId, subject, message } = req.body;
    const fromUserId = req.user.uid;
    
    if (!eventId || !bookerId || !subject || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the event belongs to the current user
    const eventSnapshot = await database.ref(`events/${eventId}`).once('value');
    const event = eventSnapshot.val();
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.authorId !== fromUserId) {
      return res.status(403).json({ error: 'Not authorized to contact bookers for this event' });
    }

    // Verify the booker exists for this event
    const bookingSnapshot = await database.ref(`events/${eventId}/bookings/${bookerId}`).once('value');
    const booking = bookingSnapshot.val();
    
    if (!booking) {
      return res.status(404).json({ error: 'Booker not found for this event' });
    }

    // Get attachments from multer
    const attachments = req.files || [];

    // Send email
    await emailService.sendContactMessage(
      fromUserId,
      bookerId,
      eventId,
      subject,
      message,
      attachments
    );

    // Log the contact attempt
    const contactLog = {
      fromUserId,
      toUserId: bookerId,
      eventId,
      subject,
      message,
      timestamp: Date.now(),
      hasAttachments: attachments.length > 0
    };

    await database.ref('contactLogs').push(contactLog);

    res.status(200).json({ 
      message: 'Contact message sent successfully',
      contactId: contactLog.timestamp
    });

  } catch (error) {
    console.error('Error contacting event booker:', error);
    res.status(500).json({ error: 'Failed to send contact message' });
  }
};

// Get contact history for current user
const getContactHistory = async (req, res) => {
  try {
    const userId = req.user.uid;
    
    // Get contacts where user is sender or recipient
    const contactsRef = database.ref('contactLogs');
    const snapshot = await contactsRef.orderByChild('timestamp').limitToLast(50).once('value');
    const contacts = snapshot.val() || {};
    
    const userContacts = Object.entries(contacts)
      .map(([id, contact]) => ({ id, ...contact }))
      .filter(contact => contact.fromUserId === userId || contact.toUserId === userId)
      .sort((a, b) => b.timestamp - a.timestamp);

    res.status(200).json(userContacts);

  } catch (error) {
    console.error('Error getting contact history:', error);
    res.status(500).json({ error: 'Failed to get contact history' });
  }
};

module.exports = {
  contactEventOrganizer,
  contactEventBooker,
  getContactHistory
}; 