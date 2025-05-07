#!/usr/bin/env node

// This script tests the connection to Supabase

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
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
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables are required'));
  console.error(chalk.yellow('💡 Create a .env file based on .env.example or set these variables in your environment'));
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(chalk.red('❌ DATABASE_URL environment variable is required'));
  console.error(chalk.yellow('💡 Create a .env file based on .env.example or set this variable in your environment'));
  process.exit(1);
}

console.log(chalk.blue('🚀 Testing connection to Supabase...'));

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testConnection() {
  try {
    // Test Supabase Auth connection
    console.log(chalk.blue('🔒 Testing Supabase Auth API...'));
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error(chalk.red('❌ Supabase Auth API connection failed:'), authError.message);
    } else {
      console.log(chalk.green('✅ Supabase Auth API connection successful'));
    }
    
    // Test database connection by trying to select from the emotions table
    console.log(chalk.blue('📊 Testing database connection...'));
    const { data: dbData, error: dbError } = await supabase
      .from('emotions')
      .select('emotion_id, emotion_name')
      .limit(1);
    
    if (dbError) {
      if (dbError.code === '42P01') {
        console.error(chalk.red('❌ Table "emotions" does not exist. Please run the database migration first.'));
        console.error(chalk.yellow('💡 Run: npm run db:push'));
      } else {
        console.error(chalk.red('❌ Database connection failed:'), dbError.message);
      }
    } else {
      console.log(chalk.green('✅ Database connection successful'));
      
      if (dbData.length > 0) {
        console.log(chalk.green(`📋 Found emotions table with data: ${dbData[0].emotion_name} (ID: ${dbData[0].emotion_id})`));
      } else {
        console.log(chalk.yellow('⚠️ Emotions table exists but appears to be empty'));
        console.log(chalk.yellow('💡 Run the seed script: node scripts/seed-emotions.js'));
      }
    }
    
    console.log('');
    console.log(chalk.green('🔍 Supabase connection test completed'));
    
  } catch (error) {
    console.error(chalk.red('❌ Unexpected error:'), error);
    process.exit(1);
  }
}

// Run the test
testConnection().catch(console.error);