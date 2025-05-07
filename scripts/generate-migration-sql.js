#!/usr/bin/env node

// This script generates SQL migration scripts for Supabase

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { execSync } from 'child_process';

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

console.log(chalk.blue('🚀 Generating SQL migration scripts...'));

try {
  // Create migrations folder if it doesn't exist
  const migrationsPath = join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    fs.mkdirSync(migrationsPath, { recursive: true });
    console.log(chalk.blue(`📁 Created migrations directory at ${migrationsPath}`));
  }
  
  // Generate SQL migration
  console.log(chalk.blue('📝 Running drizzle-kit generate...'));
  
  execSync('npx drizzle-kit generate', { 
    stdio: 'inherit',
    env: {
      ...process.env
    }
  });
  
  console.log(chalk.green('✅ SQL migration scripts generated!'));
  console.log(chalk.blue('📁 Check the "migrations" folder for the generated SQL files'));
  
  // Display path to migration files
  const migrationsPath = join(process.cwd(), 'migrations');
  if (fs.existsSync(migrationsPath)) {
    const sqlFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .map(file => join(migrationsPath, file));
    
    if (sqlFiles.length > 0) {
      console.log(chalk.blue('📋 Generated SQL files:'));
      sqlFiles.forEach(file => {
        console.log(chalk.yellow(`   - ${file.replace(process.cwd(), '')}`));
      });
      
      // Display content of the first SQL file as an example
      if (sqlFiles.length > 0) {
        const firstSqlFile = sqlFiles[0];
        console.log('');
        console.log(chalk.blue(`📄 Example SQL content from ${firstSqlFile.replace(process.cwd(), '')}:`));
        
        const content = fs.readFileSync(firstSqlFile, 'utf8');
        const preview = content.split('\n').slice(0, 10).join('\n') + 
          (content.split('\n').length > 10 ? '\n...' : '');
        
        console.log(chalk.gray(preview));
      }
    } else {
      console.log(chalk.yellow('⚠️ No SQL files generated. Your schema might be up to date.'));
    }
  } else {
    console.log(chalk.red('❌ Migrations folder not found. Something went wrong with drizzle-kit.'));
  }
  
  console.log('');
  console.log(chalk.green('🎉 SQL generation completed!'));
  console.log('');
  console.log(chalk.blue('Next steps:'));
  console.log(chalk.blue('1. Apply the SQL migration to your Supabase database using the SQL Editor:'));
  console.log(chalk.yellow('   https://app.supabase.io/project/_/sql'));
  console.log(chalk.blue('2. Seed data for emotions:'));
  console.log(chalk.yellow('   node scripts/seed-emotions.js'));
  
} catch (error) {
  console.error(chalk.red('❌ Error generating SQL migration:'));
  console.error(chalk.red(error.message || error));
  process.exit(1);
}