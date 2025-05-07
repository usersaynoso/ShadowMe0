#!/usr/bin/env node

// This script seeds the emotions table with initial data

import { createClient } from '@supabase/supabase-js';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import chalk from 'chalk';

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
if (!process.env.DATABASE_URL) {
  console.error(chalk.red('❌ DATABASE_URL environment variable is required'));
  console.error(chalk.yellow('💡 Create a .env file based on .env.example or set this variable in your environment'));
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn(chalk.yellow('⚠️ SUPABASE_URL and/or SUPABASE_KEY not found. These are needed for some Supabase features.'));
  console.warn(chalk.yellow('  The database migration might still work with just DATABASE_URL, but some features might be limited.'));
}

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Configure Neon to use ws for WebSockets
neonConfig.webSocketConstructor = ws;

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
  console.log(chalk.blue('🚀 Starting emotions seeding process...'));
  
  let pool;
  
  try {
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    console.log(chalk.blue(`📊 Connected to database: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`));
    
    // Check if the emotions table exists
    console.log(chalk.blue('🔍 Checking if emotions table exists...'));
    
    const tableCheckResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'emotions'
      );
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    
    if (!tableExists) {
      console.error(chalk.red('❌ Table "emotions" does not exist. Please run the database migration first.'));
      console.error(chalk.yellow('💡 Run: npm run db:push'));
      process.exit(1);
    }
    
    // Check for existing emotions
    const existingEmotionsResult = await pool.query('SELECT emotion_id, emotion_name FROM emotions;');
    const existingEmotions = existingEmotionsResult.rows;
    
    if (existingEmotions && existingEmotions.length > 0) {
      console.log(chalk.yellow(`⚠️ Found ${existingEmotions.length} existing emotions:`));
      existingEmotions.forEach(emotion => {
        console.log(chalk.yellow(`  - ${emotion.emotion_name} (ID: ${emotion.emotion_id})`));
      });
      
      console.log(chalk.blue('ℹ️ Table already has data. Would you like to:'));
      console.log(chalk.blue('1. Keep existing emotions (default)'));
      console.log(chalk.blue('2. Skip seeding altogether'));
      
      // Default to keeping existing data
      console.log(chalk.green('✅ Using existing emotions data.'));
      
      // Get the existing emotions to display at the end
      const sampleDataResult = await pool.query('SELECT * FROM emotions LIMIT 5;');
      console.log(chalk.blue('📋 Sample data (first 5 emotions):'));
      sampleDataResult.rows.forEach(row => {
        console.log(chalk.yellow(`   - ID: ${row.emotion_id}, Name: ${row.emotion_name}, Color: ${row.emotion_color}`));
      });
      
      console.log('');
      console.log(chalk.green('🎉 All done! The emotions are already available in your Supabase database.'));
      return;
    }
    
    // If no existing emotions, insert the new ones
    console.log(chalk.blue(`🌱 Seeding ${emotions.length} emotions...`));
    
    // Begin transaction
    await pool.query('BEGIN');
    
    // Insert each emotion
    for (const emotion of emotions) {
      try {
        await pool.query(
          'INSERT INTO emotions (emotion_id, emotion_name, emotion_color) VALUES ($1, $2, $3)',
          [emotion.emotion_id, emotion.emotion_name, emotion.emotion_color]
        );
        process.stdout.write(chalk.green('.'));
      } catch (error) {
        console.error(chalk.red(`❌ Error inserting emotion ${emotion.emotion_name}:`));
        console.error(chalk.red(error.message));
        await pool.query('ROLLBACK');
        throw error;
      }
    }
    
    // Commit transaction
    await pool.query('COMMIT');
    
    process.stdout.write('\n');
    console.log(chalk.green('✅ Successfully seeded emotions!'));
    
    // Display inserted data
    const insertedDataResult = await pool.query('SELECT * FROM emotions;');
    console.log(chalk.blue(`📋 Inserted ${insertedDataResult.rows.length} emotions:`));
    insertedDataResult.rows.forEach(emotion => {
      console.log(chalk.yellow(`  - ${emotion.emotion_name} (${emotion.emotion_color})`));
    });
    
    console.log('');
    console.log(chalk.green('🎉 All done! The emotions are now available in your Supabase database.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Unexpected error:'));
    console.error(chalk.red(error.message || error));
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the seed function
seedEmotions().catch(console.error);