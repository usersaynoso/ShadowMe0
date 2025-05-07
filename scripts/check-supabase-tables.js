require('dotenv').config();
const chalk = require('chalk');
const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseTables() {
  console.log(chalk.blue('🔍 Checking all tables in Supabase database...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  // List of all expected tables
  const expectedTables = [
    'users',
    'profiles',
    'friends',
    'friend_groups',
    'friend_group_members',
    'groups',
    'group_members',
    'chat_rooms',
    'chat_room_members',
    'messages',
    'emotions',
    'posts',
    'post_audience',
    'post_media',
    'post_reactions',
    'post_comments',
    'shadow_sessions',
    'shadow_session_participants',
    'feed_events',
    'session' // For express-session
  ];
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Execute a raw query to get all tables
    const { data: tablesResult, error: tablesError } = await supabase.rpc('pg_execute', {
      query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    });
    
    if (tablesError) {
      console.error(chalk.red('❌ Error fetching tables:'), tablesError);
      process.exit(1);
    }
    
    const existingTables = tablesResult.map(row => row.table_name);
    
    // Check which tables are missing
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));
    
    // Check table counts
    const tableResults = [];
    
    for (const table of existingTables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          tableResults.push({
            table,
            status: 'error',
            message: error.message,
            count: 0
          });
        } else {
          tableResults.push({
            table,
            status: 'success',
            count
          });
        }
      } catch (err) {
        tableResults.push({
          table,
          status: 'error',
          message: err.message,
          count: 0
        });
      }
    }
    
    // Print results
    console.log(chalk.blue('\nTable Status:'));
    console.log(chalk.cyan('================================'));
    
    let hasErrors = false;
    
    // First list the expected tables
    for (const expectedTable of expectedTables) {
      const result = tableResults.find(r => r.table === expectedTable);
      if (result) {
        if (result.status === 'success') {
          console.log(chalk.green(`✅ ${result.table.padEnd(25)}`), chalk.white(`${result.count} rows`));
        } else {
          console.log(chalk.red(`❌ ${result.table.padEnd(25)}`), chalk.white(result.message));
          hasErrors = true;
        }
      } else {
        console.log(chalk.red(`❌ ${expectedTable.padEnd(25)}`), chalk.white('Table not found'));
        hasErrors = true;
      }
    }
    
    // Then list any unexpected tables
    const unexpectedTables = existingTables.filter(table => !expectedTables.includes(table));
    if (unexpectedTables.length > 0) {
      console.log(chalk.blue('\nUnexpected Tables:'));
      console.log(chalk.cyan('================================'));
      
      for (const table of unexpectedTables) {
        const result = tableResults.find(r => r.table === table);
        if (result) {
          console.log(chalk.yellow(`⚠️ ${result.table.padEnd(25)}`), chalk.white(`${result.count} rows`));
        }
      }
    }
    
    // Final summary
    console.log(chalk.cyan('\n================================'));
    if (missingTables.length > 0) {
      console.log(chalk.red(`❌ ${missingTables.length} expected tables are missing:`));
      console.log(chalk.red(missingTables.join(', ')));
      hasErrors = true;
    }
    
    if (hasErrors) {
      console.log(chalk.red('\n❌ Some tables are missing or have errors. Migration may be incomplete.'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ All expected tables exist in the database!'));
      process.exit(0);
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to check tables:'), error);
    process.exit(1);
  }
}

checkSupabaseTables();