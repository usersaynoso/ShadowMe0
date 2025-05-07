#!/usr/bin/env node

// Script to check the emotions table existence and structure

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

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

console.log(chalk.blue('🔍 Checking emotions table in Supabase database...'));

// Configure Neon to use ws for WebSockets
neonConfig.webSocketConstructor = ws;

async function checkEmotionsTable() {
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
    
    if (tableExists) {
      console.log(chalk.green('✅ The emotions table exists!'));
      
      // Get the table structure
      console.log(chalk.blue('🔍 Checking the emotions table structure...'));
      
      const columnResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'emotions';
      `);
      
      console.log(chalk.blue('📋 Emotions table has the following columns:'));
      columnResult.rows.forEach(column => {
        console.log(chalk.yellow(`   - ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'not nullable'})`));
      });
      
      // Check if the table has any data
      console.log(chalk.blue('🔍 Checking if emotions table has data...'));
      
      const countResult = await pool.query('SELECT COUNT(*) FROM emotions;');
      const count = parseInt(countResult.rows[0].count);
      
      if (count > 0) {
        console.log(chalk.green(`✅ The emotions table contains ${count} rows of data.`));
        
        // Display sample data
        const sampleDataResult = await pool.query('SELECT * FROM emotions LIMIT 5;');
        console.log(chalk.blue('📋 Sample data:'));
        sampleDataResult.rows.forEach(row => {
          console.log(chalk.yellow(`   - ID: ${row.emotion_id}, Name: ${row.emotion_name}, Color: ${row.emotion_color}`));
        });
      } else {
        console.log(chalk.yellow('⚠️ The emotions table exists but doesn\'t contain any data.'));
        console.log(chalk.yellow('💡 You may want to run the seed script: node scripts/seed-emotions.js'));
      }
    } else {
      console.log(chalk.red('❌ The emotions table does not exist.'));
      console.log(chalk.yellow('💡 You need to run the database migration first:'));
      console.log(chalk.yellow('   npm run db:push'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking emotions table:'));
    console.error(chalk.red(error.message));
    
    // If it's a permission issue, provide more helpful guidance
    if (error.message.includes('permission denied')) {
      console.log('');
      console.log(chalk.yellow('⚠️ This looks like a permission issue.'));
      console.log(chalk.yellow('💡 Make sure:'));
      console.log(chalk.yellow('  1. Your Supabase service role key has proper permissions'));
      console.log(chalk.yellow('  2. The database user has access to the public schema'));
      console.log(chalk.yellow('  3. Double-check your DATABASE_URL is correct'));
    }
    
    if (error.message.includes('relation "emotions" does not exist')) {
      console.log('');
      console.log(chalk.yellow('⚠️ The emotions table doesn\'t exist in the database.'));
      console.log(chalk.yellow('💡 Run the database migration:'));
      console.log(chalk.yellow('   npm run db:push'));
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkEmotionsTable().catch(console.error);