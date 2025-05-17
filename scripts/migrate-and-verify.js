require('dotenv').config();
const chalk = require('chalk');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function migrateAndVerify() {
  console.log(chalk.blue('🚀 Starting Supabase migration and verification process...'));
  
  try {
    // Step 1: Check for environment variables
    console.log(chalk.cyan('\n🔍 Step 1: Checking environment variables...'));
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_KEY', 'DATABASE_URL'];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        console.error(chalk.red(`❌ Missing required environment variable: ${envVar}`));
        console.error(chalk.yellow('Please make sure all required environment variables are set in .env file.'));
        process.exit(1);
      }
    }
    console.log(chalk.green('✅ All required environment variables are present.'));
    
    // Step 2: Test Supabase connection
    console.log(chalk.cyan('\n🔌 Step 2: Testing Supabase connection...'));
    try {
      execSync('npx tsx scripts/create-buckets.ts -- --check-only', { stdio: 'inherit' });
      console.log(chalk.green('✅ Supabase connection successful.'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to connect to Supabase.'));
      process.exit(1);
    }
    
    // Step 3: Check if migration is needed
    console.log(chalk.cyan('\n🔍 Step 3: Checking if migration is needed...'));
    let tablesExist = false;
    
    try {
      execSync('node scripts/check-supabase-tables.js', { stdio: 'pipe' });
      console.log(chalk.green('✅ All tables already exist. No migration needed.'));
      tablesExist = true;
    } catch (error) {
      console.log(chalk.yellow('⚠️ Some tables are missing. Migration needed.'));
    }
    
    // Step 4: Run migration if needed
    if (!tablesExist) {
      console.log(chalk.cyan('\n🗄️ Step 4: Running database migration...'));
      
      try {
        execSync('node scripts/execute-schema-sql.js', { stdio: 'inherit' });
        console.log(chalk.green('✅ Migration executed successfully.'));
      } catch (error) {
        console.error(chalk.red('❌ Migration failed.'));
        process.exit(1);
      }
      
      // Verify tables again after migration
      console.log(chalk.cyan('\n🔍 Verifying tables after migration...'));
      try {
        execSync('node scripts/check-supabase-tables.js', { stdio: 'inherit' });
        console.log(chalk.green('✅ All tables created successfully.'));
      } catch (error) {
        console.error(chalk.red('❌ Table verification failed after migration.'));
        process.exit(1);
      }
    }
    
    // Step 5: Check emotions table
    console.log(chalk.cyan('\n🎭 Step 5: Checking emotions table data...'));
    try {
      execSync('node scripts/check-emotions-table.js', { stdio: 'pipe' });
      console.log(chalk.green('✅ Emotions table has data.'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Emotions table needs to be seeded.'));
      
      // Seed emotions
      console.log(chalk.cyan('\n🌱 Seeding emotions table...'));
      try {
        execSync('npx tsx scripts/seed-emotions.ts', { stdio: 'inherit' });
        console.log(chalk.green('✅ Emotions table seeded successfully.'));
      } catch (error) {
        console.error(chalk.red('❌ Failed to seed emotions table.'));
        process.exit(1);
      }
    }
    
    // Final verification
    console.log(chalk.cyan('\n🔍 Final verification...'));
    try {
      execSync('node scripts/check-supabase-tables.js', { stdio: 'inherit' });
      console.log(chalk.green('\n✅ Migration and verification completed successfully!'));
      console.log(chalk.blue('Your Supabase database is ready to use.'));
    } catch (error) {
      console.error(chalk.red('\n❌ Final verification failed.'));
      process.exit(1);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ An error occurred during migration and verification:'), error);
    process.exit(1);
  }
}

migrateAndVerify();