#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Get Supabase credentials from .env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function checkAndSeedEmotions() {
  console.log(chalk.blue('🔍 Checking emotions table in Supabase...'));
  
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
      return false;
    }
    
    if (!emotions || emotions.length === 0) {
      console.warn(chalk.yellow('⚠️ Emotions table exists but has no data. Seeding emotions...'));
      
      // Define the default emotions
      const emotionsData = [
        { emotion_id: 1, emotion_name: 'Happy', emotion_color: '#FFD700' },
        { emotion_id: 2, emotion_name: 'Calm', emotion_color: '#89CFF0' },
        { emotion_id: 3, emotion_name: 'Sad', emotion_color: '#6495ED' },
        { emotion_id: 4, emotion_name: 'Angry', emotion_color: '#FF4500' },
        { emotion_id: 5, emotion_name: 'Anxious', emotion_color: '#DA70D6' },
        { emotion_id: 6, emotion_name: 'Excited', emotion_color: '#FF69B4' },
        { emotion_id: 7, emotion_name: 'Tired', emotion_color: '#708090' },
        { emotion_id: 8, emotion_name: 'Grateful', emotion_color: '#32CD32' },
        { emotion_id: 9, emotion_name: 'Confused', emotion_color: '#9370DB' },
        { emotion_id: 10, emotion_name: 'Hopeful', emotion_color: '#00CED1' },
        { emotion_id: 11, emotion_name: 'Bored', emotion_color: '#A9A9A9' },
        { emotion_id: 12, emotion_name: 'Loving', emotion_color: '#FF1493' }
      ];
      
      // Insert all emotions
      const { error: insertError } = await supabase
        .from('emotions')
        .insert(emotionsData);
      
      if (insertError) {
        console.error(chalk.red('❌ Error seeding emotions:'), insertError);
        return false;
      }
      
      console.log(chalk.green(`✅ Successfully seeded emotions table with ${emotionsData.length} emotions.`));
    } else {
      console.log(chalk.green(`✅ Emotions table verified successfully with ${emotions.length} emotions.`));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Failed to check/seed emotions table:'), error);
    return false;
  }
}

async function startDevServer() {
  // First check and seed emotions if needed
  const emotionsReady = await checkAndSeedEmotions();
  
  if (!emotionsReady) {
    console.warn(chalk.yellow('⚠️ Warning: Emotions may not be properly set up. The app might not work correctly.'));
  }
  
  console.log(chalk.blue('🚀 Starting development server...'));
  
  // Start the Vite dev server on port 3000
  const viteProcess = spawn('npx', ['vite', '--port', '3000', '--host', '0.0.0.0'], { 
    stdio: 'inherit',
    shell: true
  });
  
  viteProcess.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start development server:'), error);
    process.exit(1);
  });
  
  viteProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(chalk.red(`❌ Development server exited with code ${code}`));
      process.exit(code);
    }
  });
}

// Start the development process
startDevServer(); 