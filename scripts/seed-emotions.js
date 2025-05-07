#!/usr/bin/env node

// This script seeds the emotions table with initial data

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY environment variables are required');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Define emotions data
const emotions = [
  { emotion_id: 1, emotion_name: 'Happy', emotion_color: '#FFC107' },
  { emotion_id: 2, emotion_name: 'Calm', emotion_color: '#4CAF50' },
  { emotion_id: 3, emotion_name: 'Sad', emotion_color: '#2196F3' },
  { emotion_id: 4, emotion_name: 'Anxious', emotion_color: '#E91E63' },
  { emotion_id: 5, emotion_name: 'Excited', emotion_color: '#FF5722' },
  { emotion_id: 6, emotion_name: 'Thoughtful', emotion_color: '#9C27B0' },
  { emotion_id: 7, emotion_name: 'Tired', emotion_color: '#78909C' },
  { emotion_id: 8, emotion_name: 'Grateful', emotion_color: '#8BC34A' },
  { emotion_id: 9, emotion_name: 'Frustrated', emotion_color: '#F44336' },
  { emotion_id: 10, emotion_name: 'Hopeful', emotion_color: '#3F51B5' },
  { emotion_id: 11, emotion_name: 'Peaceful', emotion_color: '#00BCD4' },
  { emotion_id: 12, emotion_name: 'Confused', emotion_color: '#FF9800' }
];

async function seedEmotions() {
  console.log('🌱 Seeding emotions data...');
  
  try {
    // Clear existing emotions if any
    const { error: deleteError } = await supabase
      .from('emotions')
      .delete()
      .not('emotion_id', 'is', null);
      
    if (deleteError) {
      console.error('Error clearing existing emotions:', deleteError);
      return;
    }
    
    // Insert emotions
    const { data, error } = await supabase
      .from('emotions')
      .insert(emotions)
      .select();
      
    if (error) {
      console.error('❌ Error seeding emotions:', error);
      return;
    }
    
    console.log(`✅ Successfully seeded ${data.length} emotions:`);
    data.forEach(emotion => {
      console.log(`  - ${emotion.emotion_name} (${emotion.emotion_color})`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the seed function
seedEmotions().catch(console.error);