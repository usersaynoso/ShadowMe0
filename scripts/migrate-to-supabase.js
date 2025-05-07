#!/usr/bin/env node

// This script pushes the database schema to Supabase
// It uses Drizzle Kit to generate and apply migrations

import { spawn } from 'child_process';
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
if (!process.env.DATABASE_URL) {
  console.error(chalk.red('❌ DATABASE_URL environment variable is required'));
  console.error(chalk.yellow('💡 Create a .env file based on .env.example or set this variable in your environment'));
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.log(chalk.yellow('⚠️ SUPABASE_URL and/or SUPABASE_KEY not found. These are needed for some Supabase features.'));
  console.log(chalk.yellow('  The database migration might still work with just DATABASE_URL, but some features might be limited.'));
}

console.log(chalk.blue('🚀 Starting database migration to Supabase...'));
console.log(chalk.blue(`📊 Connected to Supabase database: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`));
console.log(chalk.blue('📝 Generating schema migrations...'));

// Run Drizzle Kit to push schema changes
const drizzleProcess = spawn('npx', ['drizzle-kit', 'push'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Using DATABASE_URL from env variables
  }
});

drizzleProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(chalk.red('❌ Schema migration failed. Please check the error message above.'));
    process.exit(code);
  }
  
  console.log(chalk.green('✅ Database schema has been migrated to Supabase successfully!'));
  
  // Check if seed-emotions.js exists
  const seedScriptPath = join(__dirname, 'seed-emotions.js');
  if (fs.existsSync(seedScriptPath)) {
    console.log(chalk.blue('🌱 Found seed-emotions.js script. You can run it next to populate your database.'));
    console.log(chalk.yellow('  Run: node scripts/seed-emotions.js'));
  }
  
  console.log('');
  console.log(chalk.green('🎉 Migration completed!'));
  console.log('');
  console.log(chalk.blue('Next steps:'));
  console.log(chalk.blue('1. Seed data for emotions:'));
  console.log(chalk.yellow('   node scripts/seed-emotions.js'));
  console.log(chalk.blue('2. Verify database connection in your application:'));
  console.log(chalk.yellow('   npm run dev'));
  console.log(chalk.blue('3. Update your environment variables in production'));
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.log('');
    console.log(chalk.red('⚠️ Remember to set SUPABASE_URL and SUPABASE_KEY for full Supabase functionality'));
  }
});