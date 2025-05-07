require('dotenv').config();
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');

async function executeMigration() {
  console.log(chalk.blue('🔄 Starting migration to Supabase...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Read and execute the migration SQL file
    const migrationFilePath = path.join(__dirname, '../migrations/complete-migration.sql');
    const migrationSQL = fs.readFileSync(migrationFilePath, 'utf8');
    
    console.log(chalk.blue('🏗️ Executing migration SQL script...'));
    
    const { error } = await supabase.rpc('pg_execute', { query: migrationSQL });
    
    if (error) {
      console.error(chalk.red('❌ Migration failed:'), error);
      process.exit(1);
    }
    
    console.log(chalk.green('✅ Migration to Supabase completed successfully!'));
    console.log(chalk.yellow('🔍 Verify the migrated data in your Supabase dashboard.'));
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error);
    process.exit(1);
  }
}

executeMigration();