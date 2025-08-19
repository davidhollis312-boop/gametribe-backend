const { database } = require("./config/firebase");

// Migration script to fix existing events with missing author information
const fixEvents = async () => {
  try {
    console.log("Starting events migration...");
    
    // Get all events
    const eventsRef = database.ref("events");
    const eventsSnapshot = await eventsRef.once("value");
    const events = eventsSnapshot.val() || {};
    
    console.log(`Found ${Object.keys(events).length} events to process`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process each event
    for (const [eventId, event] of Object.entries(events)) {
      try {
        // Check if event is missing author information
        if (!event.author || !event.authorImage) {
          console.log(`Fixing event ${eventId}...`);
          
          // Get user information
          if (event.authorId) {
            const userRef = database.ref(`users/${event.authorId}`);
            const userSnapshot = await userRef.once("value");
            
            if (userSnapshot.exists()) {
              const userData = userSnapshot.val();
              const author = userData.username || userData.email?.split("@")[0] || "Unknown User";
              const authorImage = userData.avatar || "";
              
              // Update the event
              await eventsRef.child(eventId).update({
                author,
                authorImage,
                updatedAt: new Date().toISOString()
              });
              
              console.log(`Updated event ${eventId}: author="${author}", authorImage="${authorImage}"`);
              updatedCount++;
            } else {
              console.log(`User ${event.authorId} not found for event ${eventId}`);
              errorCount++;
            }
          } else {
            console.log(`Event ${eventId} has no authorId`);
            errorCount++;
          }
        } else {
          console.log(`Event ${eventId} already has author information`);
        }
      } catch (error) {
        console.error(`Error processing event ${eventId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\nMigration completed!`);
    console.log(`Updated: ${updatedCount} events`);
    console.log(`Errors: ${errorCount} events`);
    console.log(`Total processed: ${Object.keys(events).length} events`);
    
  } catch (error) {
    console.error("Migration failed:", error.message);
  }
  
  process.exit(0);
};

// Run the migration
fixEvents(); 