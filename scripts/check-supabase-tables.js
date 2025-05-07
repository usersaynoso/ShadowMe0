#!/usr/bin/env node

// Script to check all tables in all schemas of the database

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import chalk from 'chalk';
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

console.log(chalk.blue('🔍 Checking all tables in all schemas in the Supabase database...'));

// Configure Neon to use ws for WebSockets
neonConfig.webSocketConstructor = ws;

async function checkTables() {
  let pool;
  
  try {
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    console.log(chalk.blue(`📊 Connected to database: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`));
    
    // Get database information
    const dbInfoResult = await pool.query(`
      SELECT current_database() as db_name,
             current_schema() as current_schema,
             current_user as db_user;
    `);
    
    const dbInfo = dbInfoResult.rows[0];
    console.log(chalk.green('✅ Database Info:'));
    console.log(chalk.yellow(`   - Database Name: ${dbInfo.db_name}`));
    console.log(chalk.yellow(`   - Current Schema: ${dbInfo.current_schema}`));
    console.log(chalk.yellow(`   - Connected As User: ${dbInfo.db_user}`));
    
    // Get all schemas
    console.log(chalk.blue('🔍 Fetching all schemas...'));
    
    const schemasResult = await pool.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      ORDER BY schema_name;
    `);
    
    const schemas = schemasResult.rows.map(row => row.schema_name);
    
    console.log(chalk.green(`✅ Found ${schemas.length} schemas:`));
    schemas.forEach(schema => {
      console.log(chalk.yellow(`   - ${schema}`));
    });
    
    // Get all tables in each schema
    console.log(chalk.blue('🔍 Fetching tables in each schema...'));
    
    for (const schema of schemas) {
      const tablesResult = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `, [schema]);
      
      const tables = tablesResult.rows.map(row => row.table_name);
      
      console.log(chalk.green(`✅ Schema "${schema}" has ${tables.length} tables:`));
      
      if (tables.length === 0) {
        console.log(chalk.yellow('   - No tables found in this schema'));
        continue;
      }
      
      for (const table of tables) {
        // Get row count for each table
        const countResult = await pool.query(`
          SELECT COUNT(*) as row_count
          FROM "${schema}"."${table}";
        `);
        
        const rowCount = countResult.rows[0].row_count;
        
        // Get column count
        const columnsResult = await pool.query(`
          SELECT COUNT(*) as column_count
          FROM information_schema.columns
          WHERE table_schema = $1
          AND table_name = $2;
        `, [schema, table]);
        
        const columnCount = columnsResult.rows[0].column_count;
        
        console.log(chalk.yellow(`   - ${table} (${columnCount} columns, ${rowCount} rows)`));
      }
    }

    // Try to specifically check the public.emotions table
    console.log(chalk.blue('🔍 Specifically checking for public.emotions table...'));
    
    try {
      const emotionsCountResult = await pool.query(`
        SELECT COUNT(*) as row_count FROM public.emotions;
      `);
      
      const emotionsRowCount = emotionsCountResult.rows[0].row_count;
      
      console.log(chalk.green(`✅ Found public.emotions table with ${emotionsRowCount} rows!`));
      
      if (emotionsRowCount > 0) {
        // Show sample data
        const sampleEmotionsResult = await pool.query(`
          SELECT * FROM public.emotions LIMIT 3;
        `);
        
        console.log(chalk.green('✅ Sample data from public.emotions:'));
        sampleEmotionsResult.rows.forEach(row => {
          console.log(chalk.yellow(`   - ID: ${row.emotion_id}, Name: ${row.emotion_name}, Color: ${row.emotion_color}`));
        });
      }
    } catch (error) {
      console.log(chalk.red(`❌ Error checking public.emotions table: ${error.message}`));
    }
    
    // Check full connection string details (masked for security)
    console.log(chalk.blue('🔍 Database connection details:'));
    const connectionParts = process.env.DATABASE_URL.split('@');
    if (connectionParts.length > 1) {
      const credentials = connectionParts[0].split('://');
      const protocol = credentials[0];
      const hostParts = connectionParts[1].split('/');
      const host = hostParts[0];
      const dbPath = hostParts.slice(1).join('/');
      
      console.log(chalk.yellow(`   - Protocol: ${protocol}`));
      console.log(chalk.yellow(`   - Host: ${host}`));
      console.log(chalk.yellow(`   - Database Path: ${dbPath.split('?')[0]}`));
      
      if (dbPath.includes('?')) {
        console.log(chalk.yellow(`   - Connection Parameters: ${dbPath.split('?')[1]}`));
      }
    }
    
    console.log(chalk.green('✅ Database check completed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error checking database tables:'));
    console.error(chalk.red(error.message));
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

checkTables().catch(console.error);