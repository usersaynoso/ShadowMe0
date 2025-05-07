require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function executeMigration() {
  console.log(chalk.blue('🗄️ Executing migration in Supabase...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Read the SQL migration file
    const migrationFilePath = path.join(__dirname, '../migrations/complete-migration.sql');
    if (!fs.existsSync(migrationFilePath)) {
      console.error(chalk.red(`❌ Migration file not found: ${migrationFilePath}`));
      process.exit(1);
    }
    
    let migrationSQL = fs.readFileSync(migrationFilePath, 'utf8');
    
    // Split the migration into separate statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(chalk.cyan(`Found ${statements.length} statements to execute.`));
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const statementPreview = statement.length > 50 
        ? statement.substring(0, 50) + '...' 
        : statement;
      
      process.stdout.write(chalk.yellow(`Executing statement ${i+1}/${statements.length}: ${statementPreview} `));
      
      try {
        const { error } = await supabase.rpc('pg_execute', {
          query: statement
        });
        
        if (error) {
          console.error(chalk.red('❌ Failed'));
          console.error(chalk.red(`Error: ${error.message}`));
          console.error(chalk.red(`Statement: ${statement}`));
          
          // Check if this is a "relation already exists" error - these are safe to ignore
          if (error.message.includes('already exists')) {
            console.log(chalk.yellow('  ⚠️ Table already exists. Continuing...'));
          } else {
            process.exit(1);
          }
        } else {
          console.log(chalk.green('✅ Success'));
        }
      } catch (error) {
        console.error(chalk.red('❌ Failed'));
        console.error(chalk.red(`Error: ${error.message}`));
        console.error(chalk.red(`Statement: ${statement}`));
        process.exit(1);
      }
    }
    
    console.log(chalk.green('\n✅ Migration executed successfully.'));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Failed to execute migration:'), error);
    process.exit(1);
  }
}

executeMigration();