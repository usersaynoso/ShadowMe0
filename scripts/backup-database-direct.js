import 'dotenv/config';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pg from 'postgres';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATABASE_NAME = 'lively-flower-18820603';
const OUTPUT_FILE = path.join(process.cwd(), 'DATABASE.sql');

async function backupDatabaseDirect() {
  console.log(chalk.blue('🔄 Starting direct database backup...'));
  
  if (!process.env.DATABASE_URL) {
    console.error(chalk.red('❌ DATABASE_URL environment variable must be set.'));
    process.exit(1);
  }

  // Create Postgres client
  const sql = pg(process.env.DATABASE_URL, { max: 1 });
  
  try {
    console.log(chalk.cyan(`📊 Backing up database: ${DATABASE_NAME}`));
    
    // Start building the SQL file
    let backupSql = `-- Database backup from ${DATABASE_NAME}\n`;
    backupSql += `-- Generated on ${new Date().toISOString()}\n\n`;
    
    // Get list of tables
    console.log(chalk.yellow('🔍 Getting list of tables...'));
    const tables = await sql`
      SELECT tablename FROM pg_tables 
      WHERE schemaname='public' 
      ORDER BY tablename
    `;
    
    console.log(chalk.green(`✅ Found ${tables.length} tables.`));
    
    // Add drop tables statements
    backupSql += `-- Drop existing tables (in reverse dependency order)\n`;
    for (let i = tables.length - 1; i >= 0; i--) {
      backupSql += `DROP TABLE IF EXISTS "${tables[i].tablename}" CASCADE;\n`;
    }
    backupSql += '\n';
    
    // Process each table
    for (const tableObj of tables) {
      const tableName = tableObj.tablename;
      console.log(chalk.cyan(`  - Processing table: ${tableName}`));
      
      // Get table schema
      const tableInfo = await sql`
        SELECT
          column_name, 
          data_type,
          character_maximum_length,
          column_default,
          is_nullable
        FROM 
          information_schema.columns 
        WHERE 
          table_name = ${tableName}
          AND table_schema = 'public'
        ORDER BY 
          ordinal_position
      `;
      
      // Get primary key info
      const primaryKeys = await sql`
        SELECT
          kcu.column_name
        FROM
          information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE
          tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_name = ${tableName}
          AND tc.table_schema = 'public'
        ORDER BY
          kcu.ordinal_position
      `;
      
      // Build CREATE TABLE statement
      let createTableSql = `CREATE TABLE "${tableName}" (\n`;
      
      // Add columns
      for (let i = 0; i < tableInfo.length; i++) {
        const column = tableInfo[i];
        let columnDef = `  "${column.column_name}" ${column.data_type}`;
        
        if (column.character_maximum_length) {
          columnDef += `(${column.character_maximum_length})`;
        }
        
        if (column.column_default) {
          columnDef += ` DEFAULT ${column.column_default}`;
        }
        
        if (column.is_nullable === 'NO') {
          columnDef += ' NOT NULL';
        }
        
        if (i < tableInfo.length - 1 || primaryKeys.length > 0) {
          columnDef += ',';
        }
        
        createTableSql += columnDef + '\n';
      }
      
      // Add primary key constraint
      if (primaryKeys.length > 0) {
        const pkColumns = primaryKeys.map(pk => `"${pk.column_name}"`).join(', ');
        createTableSql += `  PRIMARY KEY (${pkColumns})\n`;
      }
      
      createTableSql += ');\n\n';
      
      backupSql += `-- Table structure for ${tableName}\n`;
      backupSql += createTableSql;
      
      // Get table data
      try {
        // Use raw query to avoid issues with table name quoting
        const rows = await sql.unsafe(`SELECT * FROM "${tableName}"`);
        
        if (rows.length > 0) {
          backupSql += `-- Data for table ${tableName}\n`;
          
          for (const row of rows) {
            const columns = Object.keys(row).map(col => `"${col}"`).join(', ');
            const values = Object.values(row).map(val => {
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === 'object') {
                if (val instanceof Date) {
                  return `'${val.toISOString()}'`;
                }
                return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              }
              return val;
            }).join(', ');
            
            backupSql += `INSERT INTO "${tableName}" (${columns}) VALUES (${values});\n`;
          }
          
          backupSql += '\n';
          console.log(chalk.green(`    ✅ Exported ${rows.length} rows from ${tableName}`));
        } else {
          console.log(chalk.yellow(`    ⚠️ No data found in table ${tableName}`));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Error fetching data from table ${tableName}:`), error);
      }
    }
    
    // Write SQL to file
    fs.writeFileSync(OUTPUT_FILE, backupSql);
    console.log(chalk.green(`\n✅ Database backup completed successfully!`));
    console.log(chalk.cyan(`📁 Backup saved to: ${OUTPUT_FILE}`));
    
  } catch (error) {
    console.error(chalk.red('❌ Backup failed:'), error);
  } finally {
    await sql.end();
  }
}

backupDatabaseDirect();