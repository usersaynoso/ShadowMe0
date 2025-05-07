#!/usr/bin/env node

// Script to check Supabase connection and its database tables

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';

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

console.log(chalk.blue('🔍 Checking Supabase connection...'));
console.log(chalk.yellow(`   - Supabase URL: ${process.env.SUPABASE_URL}`));

async function checkSupabaseConnection() {
  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  
  try {
    // Test connection with a basic query to emotions table
    console.log(chalk.blue('🔍 Testing Supabase connection with a query to emotions table...'));
    
    const { data: emotions, error } = await supabase
      .from('emotions')
      .select('*')
      .limit(3);
    
    if (error) {
      console.error(chalk.red('❌ Error querying emotions table:'));
      console.error(chalk.red(error.message));
      
      // Check if table doesn't exist
      if (error.code === '42P01') {
        console.log(chalk.yellow('   - The emotions table does not exist in the Supabase project.'));
      }
      
      // Try to fetch available tables
      console.log(chalk.blue('🔍 Trying to fetch any available tables...'));
      
      try {
        // This is a PostgreSQL-specific query
        // Supabase might not allow this type of direct SQL
        const { data: tables, error: tablesError } = await supabase
          .rpc('list_tables');
        
        if (tablesError) {
          console.error(chalk.red('❌ Error fetching available tables:'));
          console.error(chalk.red(tablesError.message));
        } else if (tables && tables.length > 0) {
          console.log(chalk.green(`✅ Found ${tables.length} tables in the Supabase project:`));
          tables.forEach(table => {
            console.log(chalk.yellow(`   - ${table}`));
          });
        } else {
          console.log(chalk.yellow('   - No tables found or no permission to list tables.'));
        }
      } catch (ex) {
        console.error(chalk.red('❌ Error trying to list tables:'));
        console.error(chalk.red(ex.message));
      }
      
      // Test with a public function
      console.log(chalk.blue('🔍 Testing Supabase auth functionality...'));
      
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error(chalk.red('❌ Error with auth API:'));
        console.error(chalk.red(authError.message));
      } else {
        console.log(chalk.green('✅ Supabase auth API working!'));
        console.log(chalk.yellow('   - No active session (expected)'));
      }
      
    } else if (emotions && emotions.length > 0) {
      console.log(chalk.green('✅ Successfully queried emotions table!'));
      console.log(chalk.green('✅ Sample data:'));
      emotions.forEach(emotion => {
        console.log(chalk.yellow(`   - ID: ${emotion.emotion_id}, Name: ${emotion.emotion_name}, Color: ${emotion.emotion_color}`));
      });
      
      // Try to fetch available tables
      console.log(chalk.blue('🔍 Checking users table...'));
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(3);
        
      if (usersError) {
        console.error(chalk.red('❌ Error querying users table:'));
        console.error(chalk.red(usersError.message));
      } else if (users && users.length > 0) {
        console.log(chalk.green(`✅ Found ${users.length} users in the Supabase project:`));
        users.forEach(user => {
          // Mask email and password for privacy
          const maskedEmail = user.email ? `${user.email.substring(0, 3)}...${user.email.split('@')[1]}` : 'N/A';
          console.log(chalk.yellow(`   - User ID: ${user.user_id}, Email: ${maskedEmail}`));
        });
      } else {
        console.log(chalk.yellow('   - No users found or the users table is empty.'));
      }
    } else {
      console.log(chalk.yellow('⚠️ Emotions table exists but is empty.'));
    }
    
    console.log(chalk.blue('🔍 Checking Supabase project info...'));
    
    try {
      const { data: project, error: projectError } = await supabase
        .rpc('get_project_info');
      
      if (projectError) {
        console.error(chalk.red('❌ Error fetching project info:'));
        console.error(chalk.red(projectError.message));
      } else if (project) {
        console.log(chalk.green('✅ Supabase project info:'));
        console.log(chalk.yellow(JSON.stringify(project, null, 2)));
      }
    } catch (ex) {
      console.log(chalk.yellow('   - Project info not available: ' + ex.message));
    }
    
    console.log(chalk.green('✅ Supabase connection check completed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error connecting to Supabase:'));
    console.error(chalk.red(error.message || error));
    process.exit(1);
  }
}

checkSupabaseConnection().catch(console.error);