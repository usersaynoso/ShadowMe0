#!/usr/bin/env node

// This script generates complete SQL for Supabase migration
// It includes creating enums, tables, and seed data

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import chalk from 'chalk';

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

console.log(chalk.blue('🔍 Generating comprehensive SQL migration script...'));

// Configure Neon to use ws for WebSockets
neonConfig.webSocketConstructor = ws;

async function generateCompleteSql() {
  let pool;
  let sql = '';
  
  try {
    // Create source database connection
    console.log(chalk.blue('📊 Connecting to source database...'));
    
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    console.log(chalk.green(`✅ Connected to database: ${process.env.DATABASE_URL.split('@')[1].split('/')[0]}`));
    
    // Start building the migration SQL
    sql += `-- Shadow Me Database Migration Script
-- Generated: ${new Date().toISOString()}
-- Target: Supabase

-- This script will:
-- 1. Create all enums
-- 2. Create all tables
-- 3. Seed emotions data

BEGIN;

-- Create enums
`;
    
    // Get all enums
    console.log(chalk.blue('🔍 Extracting enum types...'));
    
    // Since we know the enums from the schema.ts file, let's define them directly
    const knownEnums = [
      { 
        enum_name: 'user_type_enum', 
        enum_values: ['user', 'moderator', 'manager', 'admin']
      },
      { 
        enum_name: 'friendship_status_enum', 
        enum_values: ['pending', 'accepted', 'blocked']
      },
      { 
        enum_name: 'parent_type_enum', 
        enum_values: ['friend_group', 'group', 'profile']
      },
      { 
        enum_name: 'session_privacy_enum', 
        enum_values: ['one_to_one', 'friend_group', 'group', 'public']
      },
      { 
        enum_name: 'post_parent_enum', 
        enum_values: ['profile', 'friend_group', 'group']
      },
      { 
        enum_name: 'audience_enum', 
        enum_values: ['everyone', 'friends', 'just_me', 'friend_group', 'group']
      },
      { 
        enum_name: 'message_type_enum', 
        enum_values: ['text', 'emoji', 'file']
      },
      { 
        enum_name: 'reaction_type_enum', 
        enum_values: ['like', 'love', 'laugh', 'care', 'wow', 'sad', 'angry', 'emoji']
      },
      { 
        enum_name: 'event_type_enum', 
        enum_values: ['friendship_accepted', 'message_sent', 'shadow_session_created', 'post_created', 'post_liked', 'post_commented']
      }
    ];
    
    for (const enumType of knownEnums) {
      sql += `-- Create ${enumType.enum_name} enum\n`;
      sql += `CREATE TYPE ${enumType.enum_name} AS ENUM (${enumType.enum_values.map(v => `'${v}'`).join(', ')});\n\n`;
    }
    
    // Get all tables
    console.log(chalk.blue('🔍 Extracting table definitions...'));
    
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(row => row.table_name);
    
    for (const table of tables) {
      // Skip session table as it will be created by the session store
      if (table === 'session') {
        continue;
      }
      
      console.log(chalk.blue(`📋 Generating CREATE TABLE for ${table}...`));
      
      // Get table columns
      const columnsQuery = `
        SELECT column_name, 
               data_type, 
               character_maximum_length,
               is_nullable, 
               column_default,
               CASE WHEN (SELECT COUNT(*) FROM information_schema.key_column_usage kcu
                           JOIN information_schema.table_constraints tc 
                            ON kcu.constraint_name = tc.constraint_name
                          WHERE kcu.table_name = c.table_name
                            AND kcu.column_name = c.column_name
                            AND tc.constraint_type = 'PRIMARY KEY') > 0 THEN true ELSE false END AS is_primary_key,
               CASE WHEN data_type = 'USER-DEFINED' THEN udt_name ELSE NULL END AS user_defined_type
        FROM information_schema.columns c
        WHERE table_schema = 'public'
        AND table_name = $1
        ORDER BY ordinal_position;
      `;
      
      const columnsResult = await pool.query(columnsQuery, [table]);
      const columns = columnsResult.rows;
      
      // Get foreign keys
      const foreignKeysQuery = `
        SELECT kcu.column_name,
               ccu.table_name AS foreign_table_name,
               ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = $1;
      `;
      
      const foreignKeysResult = await pool.query(foreignKeysQuery, [table]);
      const foreignKeys = foreignKeysResult.rows;
      
      // Generate CREATE TABLE
      sql += `-- Create ${table} table\n`;
      sql += `CREATE TABLE ${table} (\n`;
      
      // Add columns
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        let columnDef = `  ${column.column_name} `;
        
        // Handle data type
        if (column.user_defined_type) {
          // This is an enum or custom type
          columnDef += column.user_defined_type;
        } else if (column.data_type === 'character varying') {
          columnDef += column.character_maximum_length ? `VARCHAR(${column.character_maximum_length})` : 'VARCHAR';
        } else if (column.data_type === 'ARRAY') {
          // Find the array element type
          columnDef += 'TEXT[]'; // Simplified for this example
        } else {
          columnDef += column.data_type.toUpperCase();
        }
        
        // Nullability
        if (column.is_nullable === 'NO') {
          columnDef += ' NOT NULL';
        }
        
        // Default value
        if (column.column_default) {
          // Clean up Postgres-specific defaults
          let defaultValue = column.column_default;
          if (defaultValue.includes('nextval')) {
            // Handle sequences - simplified
            if (column.data_type === 'integer' || column.data_type === 'bigint') {
              defaultValue = 'GENERATED BY DEFAULT AS IDENTITY';
            }
          } else if (defaultValue.includes('uuid_generate_v4()')) {
            defaultValue = 'uuid_generate_v4()';
          } else if (defaultValue === 'now()') {
            defaultValue = 'CURRENT_TIMESTAMP';
          }
          
          if (!defaultValue.includes('GENERATED')) {
            columnDef += ` DEFAULT ${defaultValue}`;
          } else {
            columnDef += ` ${defaultValue}`;
          }
        }
        
        // Primary Key
        if (column.is_primary_key) {
          columnDef += ' PRIMARY KEY';
        }
        
        // Add comma if not the last column
        if (i < columns.length - 1 || foreignKeys.length > 0) {
          columnDef += ',';
        }
        
        sql += columnDef + '\n';
      }
      
      // Add foreign keys
      for (let i = 0; i < foreignKeys.length; i++) {
        const fk = foreignKeys[i];
        let fkDef = `  FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name})`;
        
        // Add comma if not the last foreign key
        if (i < foreignKeys.length - 1) {
          fkDef += ',';
        }
        
        sql += fkDef + '\n';
      }
      
      sql += `);\n\n`;
    }
    
    // Add emotions data
    console.log(chalk.blue('🔍 Extracting emotions data for seeding...'));
    
    const emotionsQuery = `SELECT * FROM emotions ORDER BY emotion_id;`;
    const emotionsResult = await pool.query(emotionsQuery);
    const emotions = emotionsResult.rows;
    
    if (emotions.length > 0) {
      sql += `-- Seed emotions data\n`;
      sql += `INSERT INTO emotions (emotion_id, emotion_name, emotion_color) VALUES\n`;
      
      for (let i = 0; i < emotions.length; i++) {
        const emotion = emotions[i];
        let valueLine = `  (${emotion.emotion_id}, '${emotion.emotion_name}', '${emotion.emotion_color}')`;
        
        // Add comma if not the last value
        if (i < emotions.length - 1) {
          valueLine += ',';
        } else {
          valueLine += ';';
        }
        
        sql += valueLine + '\n';
      }
      
      sql += '\n';
    }
    
    // Finalize the script
    sql += 'COMMIT;\n';
    
    // Write to a file
    const migrationDir = path.join(process.cwd(), 'migrations');
    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true });
    }
    
    const outputFilePath = path.join(migrationDir, 'complete-migration.sql');
    fs.writeFileSync(outputFilePath, sql);
    
    console.log(chalk.green(`✅ SQL migration script generated successfully!`));
    console.log(chalk.yellow(`📁 Output file: ${outputFilePath}`));
    console.log('');
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.yellow('1. Go to your Supabase dashboard: https://app.supabase.com'));
    console.log(chalk.yellow('2. Select your project and go to the "SQL Editor" tab'));
    console.log(chalk.yellow('3. Copy and paste the generated SQL or upload the SQL file'));
    console.log(chalk.yellow('4. Execute the SQL to create all tables and seed data'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error generating SQL:'));
    console.error(chalk.red(error.message || error));
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

generateCompleteSql().catch(console.error);