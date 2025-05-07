require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');

async function checkEmotionsTable() {
  console.log(chalk.blue('🔍 Checking emotions table in Supabase...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Check if emotions table exists and has data
    const { data: emotions, error } = await supabase
      .from('emotions')
      .select('*');
    
    if (error) {
      console.error(chalk.red('❌ Error checking emotions table:'), error);
      process.exit(1);
    }
    
    if (!emotions || emotions.length === 0) {
      console.warn(chalk.yellow('⚠️ Emotions table exists but has no data. Emotions need to be seeded.'));
      process.exit(1);
    }
    
    console.log(chalk.green(`✅ Emotions table verified successfully with ${emotions.length} emotions.`));
    console.log(chalk.blue('Emotions: '));
    emotions.forEach(emotion => {
      console.log(chalk.cyan(`  - ${emotion.emotion_name} (${emotion.emotion_color})`));
    });
    
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Failed to check emotions table:'), error);
    process.exit(1);
  }
}

checkEmotionsTable();