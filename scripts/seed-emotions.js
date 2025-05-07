#!/usr/bin/env node

// This script seeds the emotions table with initial data

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure we're in the project root
process.chdir(join(__dirname, '..'));

// Load environment variables from .env file if it exists
if (fs.existsSync('.env')) {
  dotenv.config();
  console.log('📂 Loaded environment variables from .env file');
} else {
  console.log('⚠️ No .env file found, using process environment variables');
}

// Check required environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY environment variables are required');
  console.error('💡 Create a .env file based on .env.example or set these variables in your environment');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Define emotions data with emotion_ids for consistency
const emotions = [
  { emotion_id: 1, emotion_name: 'Happy', emotion_color: '#FFC107', emotion_description: 'Feeling joyful and content' },
  { emotion_id: 2, emotion_name: 'Calm', emotion_color: '#4CAF50', emotion_description: 'Feeling peaceful and relaxed' },
  { emotion_id: 3, emotion_name: 'Sad', emotion_color: '#2196F3', emotion_description: 'Feeling down or unhappy' },
  { emotion_id: 4, emotion_name: 'Anxious', emotion_color: '#E91E63', emotion_description: 'Feeling worried or uneasy' },
  { emotion_id: 5, emotion_name: 'Excited', emotion_color: '#FF5722', emotion_description: 'Feeling enthusiastic and eager' },
  { emotion_id: 6, emotion_name: 'Thoughtful', emotion_color: '#9C27B0', emotion_description: 'Deep in contemplation' },
  { emotion_id: 7, emotion_name: 'Tired', emotion_color: '#78909C', emotion_description: 'Feeling fatigued or exhausted' },
  { emotion_id: 8, emotion_name: 'Grateful', emotion_color: '#8BC34A', emotion_description: 'Feeling thankful and appreciative' },
  { emotion_id: 9, emotion_name: 'Frustrated', emotion_color: '#F44336', emotion_description: 'Feeling annoyed or hindered' },
  { emotion_id: 10, emotion_name: 'Hopeful', emotion_color: '#3F51B5', emotion_description: 'Optimistic about the future' },
  { emotion_id: 11, emotion_name: 'Peaceful', emotion_color: '#00BCD4', emotion_description: 'Feeling tranquil and harmonious' },
  { emotion_id: 12, emotion_name: 'Confused', emotion_color: '#FF9800', emotion_description: 'Feeling puzzled or uncertain' }
];

async function seedEmotions() {
  console.log('🚀 Starting emotions seeding process...');
  console.log(`📊 Connected to Supabase project: ${process.env.SUPABASE_URL}`);
  
  try {
    console.log('🔍 Checking if emotions table exists...');
    
    // Check if emotions table exists by trying to select from it
    const { error: tableCheckError } = await supabase
      .from('emotions')
      .select('emotion_id')
      .limit(1);
    
    if (tableCheckError && tableCheckError.code === '42P01') {
      console.error('❌ Table "emotions" does not exist. Please run the database migration first.');
      console.error('💡 Run: npm run db:push');
      process.exit(1);
    }
    
    // Check for existing emotions
    const { data: existingEmotions, error: checkError } = await supabase
      .from('emotions')
      .select('emotion_id, emotion_name');
      
    if (checkError) {
      console.error('❌ Error checking existing emotions:', checkError);
      process.exit(1);
    }
    
    if (existingEmotions && existingEmotions.length > 0) {
      console.log(`⚠️ Found ${existingEmotions.length} existing emotions:`);
      existingEmotions.forEach(emotion => {
        console.log(`  - ${emotion.emotion_name} (ID: ${emotion.emotion_id})`);
      });
      
      // Confirm if user wants to delete existing emotions
      console.log('🗑️ Clearing existing emotions...');
      
      // Clear existing emotions
      const { error: deleteError } = await supabase
        .from('emotions')
        .delete()
        .not('emotion_id', 'is', null);
        
      if (deleteError) {
        console.error('❌ Error clearing existing emotions:', deleteError);
        process.exit(1);
      }
      
      console.log('✅ Existing emotions cleared successfully.');
    } else {
      console.log('✅ No existing emotions found. Ready to seed.');
    }
    
    // Insert emotions
    console.log(`🌱 Seeding ${emotions.length} emotions...`);
    
    const { data, error } = await supabase
      .from('emotions')
      .insert(emotions)
      .select();
      
    if (error) {
      console.error('❌ Error seeding emotions:', error);
      process.exit(1);
    }
    
    console.log(`✅ Successfully seeded ${data.length} emotions:`);
    data.forEach(emotion => {
      console.log(`  - ${emotion.emotion_name} (${emotion.emotion_color})`);
    });
    
    console.log('');
    console.log('🎉 All done! The emotions are now available in your Supabase database.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the seed function
seedEmotions().catch(console.error);