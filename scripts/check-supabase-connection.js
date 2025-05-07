require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseConnection() {
  console.log(chalk.blue('🔌 Testing connection to Supabase...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Test connection with a simple query
    const { data, error } = await supabase.rpc('pg_execute', {
      query: 'SELECT NOW() as current_time'
    });
    
    if (error) {
      console.error(chalk.red('❌ Failed to connect to Supabase:'), error);
      process.exit(1);
    }
    
    // Check database information
    const { data: dbInfo, error: dbInfoError } = await supabase.rpc('pg_execute', {
      query: `
        SELECT 
          current_database() as database_name,
          current_user as connected_user,
          version() as postgres_version
      `
    });
    
    if (dbInfoError) {
      console.error(chalk.red('❌ Failed to fetch database information:'), dbInfoError);
      process.exit(1);
    }
    
    // Display connection info
    console.log(chalk.green('✅ Successfully connected to Supabase!'));
    console.log(chalk.blue('Connection Information:'));
    console.log(chalk.cyan(`  Database: ${dbInfo[0].database_name}`));
    console.log(chalk.cyan(`  User: ${dbInfo[0].connected_user}`));
    console.log(chalk.cyan(`  PostgreSQL Version: ${dbInfo[0].postgres_version}`));
    console.log(chalk.cyan(`  Current Time: ${data[0].current_time}`));
    
    // Check environment variables
    console.log(chalk.blue('\nEnvironment Variables:'));
    const envVars = [
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_KEY',
      'PGHOST',
      'PGPORT',
      'PGUSER',
      'PGDATABASE'
    ];
    
    for (const envVar of envVars) {
      if (process.env[envVar]) {
        console.log(chalk.green(`  ✅ ${envVar}: `), chalk.cyan('Set'));
      } else {
        console.log(chalk.red(`  ❌ ${envVar}: `), chalk.cyan('Not set'));
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Failed to connect to Supabase:'), error);
    process.exit(1);
  }
}

checkSupabaseConnection();