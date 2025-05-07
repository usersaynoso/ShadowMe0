import 'dotenv/config';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function backupDatabase() {
  console.log(chalk.blue('🔄 Starting database backup...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const DATABASE_NAME = 'lively-flower-18820603';
  const OUTPUT_FILE = path.join(process.cwd(), 'DATABASE.sql');
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log(chalk.cyan(`📊 Backing up database: ${DATABASE_NAME}`));
    
    // Generate schema and table list
    console.log(chalk.yellow('🔍 Getting list of tables...'));
    
    const { data: tablesData, error: tablesError } = await supabase.rpc('pg_execute', {
      query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    });
    
    if (tablesError) {
      console.error(chalk.red('❌ Error fetching tables:'), tablesError);
      process.exit(1);
    }
    
    const tables = tablesData.map(row => row.table_name);
    console.log(chalk.green(`✅ Found ${tables.length} tables.`));
    
    // Start building the SQL file
    let sql = `-- Database backup from ${DATABASE_NAME}\n`;
    sql += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    // Add drop tables in reverse order to handle foreign key constraints
    sql += `-- Drop existing tables (in reverse dependency order)\n`;
    for (let i = tables.length - 1; i >= 0; i--) {
      sql += `DROP TABLE IF EXISTS ${tables[i]} CASCADE;\n`;
    }
    sql += '\n';
    
    // Get schema for each table
    console.log(chalk.yellow('📝 Getting table schemas...'));
    
    for (const table of tables) {
      console.log(chalk.cyan(`  - Processing table: ${table}`));
      
      // Get table schema
      const { data: schemaData, error: schemaError } = await supabase.rpc('pg_execute', {
        query: `
          SELECT 
            pg_get_tabledef('${table}') as table_def
        `
      });
      
      if (schemaError) {
        // If pg_get_tabledef function doesn't exist, use alternate approach
        console.log(chalk.yellow(`    Function pg_get_tabledef not available, using alternate method for table: ${table}`));
        
        // Get columns
        const { data: columnsData, error: columnsError } = await supabase.rpc('pg_execute', {
          query: `
            SELECT 
              column_name, 
              data_type,
              character_maximum_length,
              column_default,
              is_nullable
            FROM 
              information_schema.columns 
            WHERE 
              table_name = '${table}'
              AND table_schema = 'public'
            ORDER BY 
              ordinal_position
          `
        });
        
        if (columnsError) {
          console.error(chalk.red(`❌ Error getting columns for table ${table}:`), columnsError);
          continue;
        }
        
        // Get primary key
        const { data: pkData, error: pkError } = await supabase.rpc('pg_execute', {
          query: `
            SELECT
              kcu.column_name
            FROM
              information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE
              tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = '${table}'
              AND tc.table_schema = 'public'
            ORDER BY
              kcu.ordinal_position
          `
        });
        
        if (pkError) {
          console.error(chalk.red(`❌ Error getting primary key for table ${table}:`), pkError);
          continue;
        }
        
        // Build CREATE TABLE statement
        let createTableSql = `CREATE TABLE ${table} (\n`;
        
        // Add columns
        for (let i = 0; i < columnsData.length; i++) {
          const col = columnsData[i];
          let colDef = `  ${col.column_name} ${col.data_type}`;
          
          if (col.character_maximum_length) {
            colDef += `(${col.character_maximum_length})`;
          }
          
          if (col.column_default) {
            colDef += ` DEFAULT ${col.column_default}`;
          }
          
          if (col.is_nullable === 'NO') {
            colDef += ' NOT NULL';
          }
          
          if (i < columnsData.length - 1 || pkData.length > 0) {
            colDef += ',';
          }
          
          createTableSql += colDef + '\n';
        }
        
        // Add primary key constraint
        if (pkData.length > 0) {
          const pkColumns = pkData.map(pk => pk.column_name).join(', ');
          createTableSql += `  PRIMARY KEY (${pkColumns})\n`;
        }
        
        createTableSql += ');\n\n';
        
        sql += `-- Table structure for ${table}\n`;
        sql += createTableSql;
      } else {
        // Use the pg_get_tabledef result
        sql += `-- Table structure for ${table}\n`;
        sql += schemaData[0].table_def + '\n\n';
      }
      
      // Get data from table
      try {
        const { data: tableData, error: dataError } = await supabase
          .from(table)
          .select('*');
        
        if (dataError) {
          console.error(chalk.red(`❌ Error fetching data from table ${table}:`), dataError);
          continue;
        }
        
        if (tableData && tableData.length > 0) {
          sql += `-- Data for table ${table}\n`;
          
          for (const row of tableData) {
            const columns = Object.keys(row).join(', ');
            const values = Object.values(row).map(val => {
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return val;
            }).join(', ');
            
            sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
          }
          
          sql += '\n';
          console.log(chalk.green(`    ✅ Exported ${tableData.length} rows from ${table}`));
        } else {
          console.log(chalk.yellow(`    ⚠️ No data found in table ${table}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error processing data for table ${table}:`), error);
      }
    }
    
    // Write SQL to file
    fs.writeFileSync(OUTPUT_FILE, sql);
    console.log(chalk.green(`\n✅ Database backup completed successfully!`));
    console.log(chalk.cyan(`📁 Backup saved to: ${OUTPUT_FILE}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Backup failed:'), error);
    process.exit(1);
  }
}

// This function might not exist in Supabase, so we'll create it if needed
async function createTableDefFunction(supabase) {
  try {
    const { error } = await supabase.rpc('pg_execute', {
      query: `
        CREATE OR REPLACE FUNCTION pg_get_tabledef(p_table_name VARCHAR) 
        RETURNS TEXT AS $$
        DECLARE
          v_table_ddl   TEXT;
          column_record RECORD;
          table_rec     RECORD;
          constraint_rec RECORD;
          firstrec      BOOLEAN;
        BEGIN
          FOR table_rec IN 
            SELECT * FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = p_table_name
            AND table_type = 'BASE TABLE'
          LOOP
            v_table_ddl = 'CREATE TABLE ' || p_table_name || ' (';
            
            firstrec = TRUE;
            FOR column_record IN 
              SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
              FROM information_schema.columns
              WHERE table_name = p_table_name
              AND table_schema = 'public'
              ORDER BY ordinal_position
            LOOP
              IF NOT firstrec THEN
                v_table_ddl = v_table_ddl || ',';
              END IF;
              firstrec = FALSE;
              
              v_table_ddl = v_table_ddl || '
  ' || column_record.column_name || ' ' || column_record.data_type;
              
              IF column_record.character_maximum_length IS NOT NULL THEN
                v_table_ddl = v_table_ddl || '(' || column_record.character_maximum_length || ')';
              END IF;
              
              IF column_record.column_default IS NOT NULL THEN
                v_table_ddl = v_table_ddl || ' DEFAULT ' || column_record.column_default;
              END IF;
              
              IF column_record.is_nullable = 'NO' THEN
                v_table_ddl = v_table_ddl || ' NOT NULL';
              END IF;
            END LOOP;
            
            -- Add primary key constraint
            FOR constraint_rec IN
              SELECT 
                string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
              FROM 
                information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
              WHERE 
                tc.constraint_type = 'PRIMARY KEY'
                AND tc.table_name = p_table_name
                AND tc.table_schema = 'public'
              GROUP BY
                tc.constraint_name
            LOOP
              IF constraint_rec.columns IS NOT NULL THEN
                v_table_ddl = v_table_ddl || ',
  PRIMARY KEY (' || constraint_rec.columns || ')';
              END IF;
            END LOOP;
            
            v_table_ddl = v_table_ddl || '
);';
          END LOOP;
          
          RETURN v_table_ddl;
        END;
        $$ LANGUAGE plpgsql;
      `
    });
    
    if (error) {
      console.error(chalk.red('❌ Error creating pg_get_tabledef function:'), error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Error creating helper function:'), error);
    return false;
  }
}

// First create helper function, then run backup
(async () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  await createTableDefFunction(supabase);
  await backupDatabase();
})();