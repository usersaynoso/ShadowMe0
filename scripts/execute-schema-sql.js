#!/usr/bin/env node

// This script executes the SQL migration against Supabase database

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
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

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn(chalk.yellow('⚠️ SUPABASE_URL and/or SUPABASE_KEY not found. These are needed for some Supabase features.'));
  console.warn(chalk.yellow('  The database migration might still work with just DATABASE_URL, but some features might be limited.'));
}

console.log(chalk.blue('🚀 Executing SQL migration against Supabase database...'));

// Configure Neon to use ws for WebSockets
neonConfig.webSocketConstructor = ws;

async function executeSchema() {
  try {
    // Create database connection
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    console.log(chalk.blue(`📊 Connected to database: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`));
    
    // Check if migrations folder exists
    const migrationsPath = join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationsPath)) {
      console.error(chalk.red('❌ Migrations folder not found. Please generate migrations first:'));
      console.error(chalk.yellow('   node scripts/generate-schema-sql.js'));
      process.exit(1);
    }
    
    // Get SQL files
    const sqlFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .map(file => join(migrationsPath, file))
      .sort(); // Sort to ensure correct order
    
    if (sqlFiles.length === 0) {
      console.error(chalk.red('❌ No SQL migration files found. Please generate migrations first:'));
      console.error(chalk.yellow('   node scripts/generate-schema-sql.js'));
      process.exit(1);
    }
    
    console.log(chalk.blue(`📋 Found ${sqlFiles.length} migration file(s)`));
    
    // Execute each SQL file
    for (const sqlFile of sqlFiles) {
      const fileName = sqlFile.split('/').pop();
      console.log(chalk.blue(`🔄 Executing ${fileName}...`));
      
      const sql = fs.readFileSync(sqlFile, 'utf8');
      
      // Split SQL by statement breakpoints
      const statements = sql.split('--> statement-breakpoint')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      console.log(chalk.blue(`📄 Executing ${statements.length} SQL statements from ${fileName}`));
      
      try {
        // Begin transaction
        await pool.query('BEGIN');
        
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          try {
            await pool.query(stmt);
            process.stdout.write(chalk.green('.'));
            
            // Add a newline every 50 statements for readability
            if ((i + 1) % 50 === 0) {
              process.stdout.write('\n');
            }
          } catch (error) {
            process.stdout.write('\n');
            console.error(chalk.red(`❌ Error executing statement ${i+1}:`));
            console.error(chalk.yellow(stmt.slice(0, 150) + (stmt.length > 150 ? '...' : '')));
            console.error(chalk.red(error.message));
            
            // If the error is about the relation already existing, we can continue
            if (error.message.includes('already exists')) {
              console.log(chalk.yellow('⚠️ Relation already exists, continuing...'));
              continue;
            }
            
            // Rollback transaction on error
            await pool.query('ROLLBACK');
            throw error;
          }
        }
        
        // Commit transaction
        await pool.query('COMMIT');
        process.stdout.write('\n');
        console.log(chalk.green(`✅ Successfully executed ${fileName}`));
        
      } catch (error) {
        process.stdout.write('\n');
        console.error(chalk.red(`❌ Failed to execute ${fileName}:`));
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    }
    
    console.log(chalk.green('✅ All SQL migrations executed successfully!'));
    
    // Close the pool
    await pool.end();
    
    console.log('');
    console.log(chalk.green('🎉 Database schema migration completed!'));
    console.log('');
    console.log(chalk.blue('Next step:'));
    console.log(chalk.blue('1. Seed data for emotions:'));
    console.log(chalk.yellow('   node scripts/seed-emotions.js'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error executing SQL migration:'));
    console.error(chalk.red(error.message || error));
    process.exit(1);
  }
}

executeSchema().catch(console.error);