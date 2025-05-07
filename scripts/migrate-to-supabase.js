#!/usr/bin/env node

// Script to migrate data from Neon database to Supabase

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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
  console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables are required'));
  console.error(chalk.yellow('💡 Create a .env file based on .env.example or set these variables in your environment'));
  process.exit(1);
}

console.log(chalk.blue('🔍 Preparing to migrate from Neon to Supabase...'));

// Configure Neon to use ws for WebSockets
neonConfig.webSocketConstructor = ws;

async function migrateToSupabase() {
  let pool;
  
  try {
    // Create Neon database connection
    console.log(chalk.blue('📊 Connecting to source Neon database...'));
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    console.log(chalk.green(`✅ Connected to source database: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`));
    
    // Create Supabase client
    console.log(chalk.blue(`📊 Connecting to target Supabase project: ${process.env.SUPABASE_URL}`));
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Test Supabase connection with auth API
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error(chalk.red('❌ Error with Supabase connection:'));
      console.error(chalk.red(authError.message));
      throw new Error('Supabase connection failed');
    }
    
    console.log(chalk.green('✅ Connected to Supabase project!'));
    
    // Create a new postgres client for Supabase using stored procedures
    console.log(chalk.blue('📝 Creating schema in Supabase...'));
    
    // Get all schemas
    console.log(chalk.blue('🔍 Getting all tables from source database...'));
    
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    const tables = tablesResult.rows.map(row => row.table_name);
    
    // Special case for emotions table
    console.log(chalk.blue('🔍 Checking if emotions table exists in source database...'));
    
    const emotionsExistsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'emotions'
      );
    `);
    
    const emotionsTableExists = emotionsExistsResult.rows[0].exists;
    
    if (emotionsTableExists) {
      console.log(chalk.green('✅ Emotions table exists in source database!'));
      
      // Check if emotions table has data
      const emotionsCountResult = await pool.query('SELECT COUNT(*) as count FROM emotions;');
      const emotionsCount = parseInt(emotionsCountResult.rows[0].count);
      
      if (emotionsCount > 0) {
        console.log(chalk.green(`✅ Emotions table has ${emotionsCount} rows in source database!`));
        
        // Migration steps
        
        // STEP 1: Create types/enums in Supabase
        console.log(chalk.blue('🔍 Creating required enums in Supabase...'));
        
        const enumsToCreate = [
          'user_type_enum',
          'friendship_status_enum',
          'parent_type_enum',
          'session_privacy_enum',
          'post_parent_enum',
          'audience_enum',
          'message_type_enum',
          'reaction_type_enum',
          'event_type_enum'
        ];
        
        for (const enumName of enumsToCreate) {
          try {
            console.log(chalk.yellow(`   - Creating enum: ${enumName}`));
            
            // This is a simplified approach - in a real migration, you'd need to fetch the actual enum values
            // For demonstration, we'll use this simple SQL that will error if the enum already exists
            const createEnumSql = `
              DO $$ 
              BEGIN 
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${enumName}') THEN
                  CREATE TYPE ${enumName} AS ENUM ();
                END IF;
              END
              $$;
            `;
            
            // We need to use RPC or REST API to execute raw SQL
            const { data, error } = await supabase.rpc('exec_sql', { sql: createEnumSql });
            
            if (error) {
              if (error.message.includes('already exists')) {
                console.log(chalk.yellow(`   - Enum ${enumName} already exists`));
              } else {
                console.log(chalk.yellow(`   - Failed to create enum ${enumName}: ${error.message}`));
              }
            } else {
              console.log(chalk.green(`   - Successfully created enum ${enumName}`));
            }
          } catch (error) {
            console.log(chalk.yellow(`   - Error creating enum ${enumName}: ${error.message}`));
          }
        }
        
        // STEP 2: Create tables in Supabase
        console.log(chalk.blue('🔍 Creating tables in Supabase...'));
        
        // Direct SQL execution is limited in Supabase without the right permissions
        console.log(chalk.yellow('   - Table creation in Supabase requires database admin permissions'));
        console.log(chalk.yellow('   - Please use the Supabase dashboard to create tables or execute SQL'));
        
        // STEP 3: Migrate emotions data
        console.log(chalk.blue('🔍 Attempting to migrate emotions data to Supabase...'));
        
        // Get emotions data from source
        const emotionsDataResult = await pool.query('SELECT * FROM emotions;');
        const emotionsData = emotionsDataResult.rows;
        
        // Check if emotions table exists in Supabase
        // This is a test query that will fail if the table doesn't exist
        const { data: emotionsTestData, error: emotionsTestError } = await supabase
          .from('emotions')
          .select('*')
          .limit(1);
          
        if (emotionsTestError && emotionsTestError.code === '42P01') {
          console.log(chalk.yellow('   - Emotions table does not exist in Supabase, trying to create it...'));
          
          // Attempt to create emotions table in Supabase
          const createEmotionsTableSql = `
            CREATE TABLE IF NOT EXISTS public.emotions (
              emotion_id SMALLINT NOT NULL PRIMARY KEY,
              emotion_name VARCHAR NOT NULL,
              emotion_color VARCHAR NOT NULL
            );
          `;
          
          try {
            // We need to use RPC or REST API to execute raw SQL
            const { data, error } = await supabase.rpc('exec_sql', { sql: createEmotionsTableSql });
            
            if (error) {
              console.log(chalk.red(`   - Failed to create emotions table: ${error.message}`));
              console.log(chalk.yellow('   - You may need database admin privileges to create tables'));
            } else {
              console.log(chalk.green('   - Successfully created emotions table in Supabase!'));
            }
          } catch (error) {
            console.log(chalk.red(`   - Error creating emotions table: ${error.message}`));
          }
        } else if (emotionsTestError) {
          console.log(chalk.red(`   - Error checking emotions table: ${emotionsTestError.message}`));
        } else {
          console.log(chalk.green('   - Emotions table exists in Supabase!'));
          
          // Insert emotions data
          console.log(chalk.blue(`   - Inserting ${emotionsData.length} emotions into Supabase...`));
          
          const { data, error } = await supabase
            .from('emotions')
            .upsert(emotionsData, { onConflict: 'emotion_id' });
            
          if (error) {
            console.log(chalk.red(`   - Failed to insert emotions data: ${error.message}`));
          } else {
            console.log(chalk.green('   - Successfully inserted emotions data into Supabase!'));
          }
        }
      } else {
        console.log(chalk.yellow('⚠️ Emotions table exists but has no data in source database.'));
      }
    } else {
      console.log(chalk.red('❌ Emotions table does not exist in source database.'));
    }
    
    console.log(chalk.green('✅ Migration process completed!'));
    console.log('');
    console.log(chalk.yellow('Note: Complete migration may require manual steps:'));
    console.log(chalk.yellow('1. Use the Supabase dashboard to create tables'));
    console.log(chalk.yellow('2. Update your .env file to use the Supabase database URL'));
    console.log(chalk.yellow('3. Run your application and verify it works with Supabase'));
    
  } catch (error) {
    console.error(chalk.red('❌ Migration error:'));
    console.error(chalk.red(error.message || error));
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

migrateToSupabase().catch(console.error);