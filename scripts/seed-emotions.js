require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');

async function seedEmotions() {
  console.log(chalk.blue('🌱 Seeding emotions table in Supabase...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  // Define the default emotions
  const emotions = [
    { emotion_id: 1, emotion_name: 'Happy', emotion_color: '#FFD700', emotion_description: 'Feeling joy, contentment or satisfaction' },
    { emotion_id: 2, emotion_name: 'Calm', emotion_color: '#89CFF0', emotion_description: 'Feeling peaceful, tranquil or relaxed' },
    { emotion_id: 3, emotion_name: 'Sad', emotion_color: '#6495ED', emotion_description: 'Feeling unhappy, down or blue' },
    { emotion_id: 4, emotion_name: 'Angry', emotion_color: '#FF4500', emotion_description: 'Feeling frustrated, irritated or mad' },
    { emotion_id: 5, emotion_name: 'Anxious', emotion_color: '#DA70D6', emotion_description: 'Feeling worried, nervous or uneasy' },
    { emotion_id: 6, emotion_name: 'Excited', emotion_color: '#FF69B4', emotion_description: 'Feeling enthusiastic, eager or thrilled' },
    { emotion_id: 7, emotion_name: 'Tired', emotion_color: '#708090', emotion_description: 'Feeling exhausted, fatigued or sleepy' },
    { emotion_id: 8, emotion_name: 'Grateful', emotion_color: '#32CD32', emotion_description: 'Feeling thankful, appreciative or blessed' },
    { emotion_id: 9, emotion_name: 'Confused', emotion_color: '#9370DB', emotion_description: 'Feeling puzzled, perplexed or uncertain' },
    { emotion_id: 10, emotion_name: 'Hopeful', emotion_color: '#00CED1', emotion_description: 'Feeling optimistic, encouraged or positive' },
    { emotion_id: 11, emotion_name: 'Bored', emotion_color: '#A9A9A9', emotion_description: 'Feeling uninterested, weary or restless' },
    { emotion_id: 12, emotion_name: 'Loving', emotion_color: '#FF1493', emotion_description: 'Feeling affectionate, caring or warm' }
  ];
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check if table is empty first
    const { data: existingEmotions, error: checkError } = await supabase
      .from('emotions')
      .select('emotion_id')
      .limit(1);
    
    if (checkError) {
      console.error(chalk.red('❌ Error checking emotions table:'), checkError);
      process.exit(1);
    }
    
    if (existingEmotions && existingEmotions.length > 0) {
      console.log(chalk.yellow('⚠️ Emotions table already has data. Skipping seeding.'));
      process.exit(0);
    }
    
    // Insert all emotions
    const { error: insertError } = await supabase
      .from('emotions')
      .insert(emotions);
    
    if (insertError) {
      console.error(chalk.red('❌ Error seeding emotions:'), insertError);
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Successfully seeded emotions table with ${emotions.length} emotions.`));
    console.log(chalk.blue('Emotions: '));
    emotions.forEach(emotion => {
      console.log(chalk.cyan(`  - ${emotion.emotion_name} (${emotion.emotion_color})`));
    });
    
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Failed to seed emotions:'), error);
    process.exit(1);
  }
}

seedEmotions();