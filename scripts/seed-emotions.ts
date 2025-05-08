import { db } from '../server/db';
import { emotions } from '../shared/schema';

async function seedEmotions() {
  console.log('Seeding emotions data...');
  
  try {
    // First, check if emotions data already exists
    const existingEmotions = await db.select().from(emotions);
    
    if (existingEmotions.length > 0) {
      console.log(`Found ${existingEmotions.length} existing emotions. Skipping seed.`);
      return;
    }
    
    // Insert emotion data
    const emotionsData = [
      { emotion_id: 1, emotion_name: 'Happy', emotion_color: '#FFD700' },
      { emotion_id: 2, emotion_name: 'Sad', emotion_color: '#4682B4' },
      { emotion_id: 3, emotion_name: 'Angry', emotion_color: '#FF4500' },
      { emotion_id: 4, emotion_name: 'Anxious', emotion_color: '#9370DB' },
      { emotion_id: 5, emotion_name: 'Calm', emotion_color: '#48D1CC' },
      { emotion_id: 6, emotion_name: 'Excited', emotion_color: '#FF6347' },
      { emotion_id: 7, emotion_name: 'Tired', emotion_color: '#778899' },
      { emotion_id: 8, emotion_name: 'Grateful', emotion_color: '#32CD32' },
      { emotion_id: 9, emotion_name: 'Confused', emotion_color: '#DDA0DD' },
      { emotion_id: 10, emotion_name: 'Frustrated', emotion_color: '#CD5C5C' },
      { emotion_id: 11, emotion_name: 'Hopeful', emotion_color: '#87CEEB' },
      { emotion_id: 12, emotion_name: 'Love', emotion_color: '#FF69B4' },
    ];
    
    await db.insert(emotions).values(emotionsData);
    
    console.log('Successfully seeded emotions data!');
  } catch (error) {
    console.error('Error seeding emotions data:', error);
  } finally {
    // Close pool to prevent hanging
    process.exit(0);
  }
}

// Run the seed function
seedEmotions(); 