const emailService = require('../services/emailService');
const { database } = require('../config/firebase');

// Send contact message to event organizer
const contactEventOrganizer = async (req, res) => {
  try {
    console.log('🔍 Backend Debug - Request body:', req.body);
    console.log('🔍 Backend Debug - Request files:', req.files);
    console.log('🔍 Backend Debug - Request user:', req.user);
    console.log('🔍 Backend Debug - Request headers:', req.headers);
    
    const { eventId, subject, message } = req.body;
    const fromUserId = req.user.uid;
    
    console.log('🔍 Backend Debug - Extracted fields:', { eventId, subject, message, fromUserId });
    
    if (!eventId || !subject || !message) {
      console.log('❌ Missing fields:', { eventId, subject, message });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get event details
    console.log('🔍 Backend Debug - Attempting to fetch event:', eventId);
    let event, organizerId;
    
    try {
      const eventSnapshot = await database.ref(`events/${eventId}`).once('value');
      event = eventSnapshot.val();
      console.log('🔍 Backend Debug - Event snapshot:', eventSnapshot.exists(), event);
      
      if (!event) {
        console.log('❌ Event not found in database');
        return res.status(404).json({ error: 'Event not found' });
      }

      organizerId = event.authorId;
      console.log('🔍 Backend Debug - Organizer ID:', organizerId, 'From User ID:', fromUserId);
      
      // Allow self-contact for event creators (they might want to ask questions about their own events)
      if (fromUserId === organizerId) {
        console.log('ℹ️ User contacting themselves about their own event (allowed)');
      }
    } catch (dbError) {
      console.error('❌ Database error fetching event:', dbError);
      return res.status(500).json({ error: 'Database error fetching event' });
    }

    // Get attachments from multer
    const attachments = req.files || [];

    // Send email
    console.log('🔍 Backend Debug - Attempting to send email with:', {
      fromUserId,
      organizerId,
      eventId,
      subject,
      message,
      attachmentsCount: attachments.length
    });
    
    try {
      await emailService.sendContactMessage(
        fromUserId,
        organizerId,
        eventId,
        subject,
        message,
        attachments
      );
      console.log('✅ Email sent successfully');
    } catch (emailError) {
      console.error('❌ Email service error:', emailError);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    // Log the contact attempt
    console.log('🔍 Backend Debug - Attempting to log contact to database');
    const contactLog = {
      fromUserId,
      toUserId: organizerId,
      eventId,
      subject,
      message,
      timestamp: Date.now(),
      hasAttachments: attachments.length > 0
    };
    console.log('🔍 Backend Debug - Contact log data:', contactLog);

    try {
      await database.ref('contactLogs').push(contactLog);
      console.log('✅ Contact logged to database successfully');
    } catch (logError) {
      console.error('❌ Database logging error:', logError);
      // Don't fail the whole request if logging fails
    }

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