import 'dotenv/config';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createDatabaseBackup() {
  console.log(chalk.blue('📦 Creating database backup from Supabase...'));
  
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(chalk.red('❌ SUPABASE_URL and SUPABASE_KEY environment variables must be set.'));
    process.exit(1);
  }
  
  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Output file path
    const outputFilePath = path.join(__dirname, '../DATABASE.sql');
    
    // Get list of tables
    const { data: tablesResult, error: tablesError } = await supabase.rpc('pg_execute', {
      query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    });
    
    if (tablesError) {
      console.error(chalk.red('❌ Error fetching tables:'), tablesError);
      process.exit(1);
    }
    
    const tables = tablesResult.map(row => row.table_name);
    console.log(chalk.cyan(`Found ${tables.length} tables to backup.`));
    
    // Get schema definitions
    console.log(chalk.cyan('\nExtracting schema definitions...'));
    const { data: schemaData, error: schemaError } = await supabase.rpc('pg_execute', {
      query: `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM 
          information_schema.columns
        WHERE 
          table_schema = 'public'
        ORDER BY 
          table_name, ordinal_position
      `
    });
    
    if (schemaError) {
      console.error(chalk.red('❌ Error fetching schema:'), schemaError);
      process.exit(1);
    }
    
    // Get constraint definitions
    console.log(chalk.cyan('Extracting constraints...'));
    const { data: constraintData, error: constraintError } = await supabase.rpc('pg_execute', {
      query: `
        SELECT
          tc.table_name, 
          tc.constraint_name, 
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM 
          information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          LEFT JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE 
          tc.table_schema = 'public'
        ORDER BY
          tc.table_name, 
          tc.constraint_name
      `
    });
    
    if (constraintError) {
      console.error(chalk.red('❌ Error fetching constraints:'), constraintError);
      process.exit(1);
    }
    
    // Get sequence definitions
    console.log(chalk.cyan('Extracting sequences...'));
    const { data: sequenceData, error: sequenceError } = await supabase.rpc('pg_execute', {
      query: `
        SELECT 
          sequence_name 
        FROM 
          information_schema.sequences
        WHERE 
          sequence_schema = 'public'
      `
    });
    
    if (sequenceError) {
      console.error(chalk.red('❌ Error fetching sequences:'), sequenceError);
      process.exit(1);
    }
    
    // Create SQL backup content
    let backupSQL = '';
    
    // Add header and initial setup
    backupSQL += `-- Shadow Me Database Backup
-- Generated on: ${new Date().toISOString()}
-- 
-- This file contains both the schema and data from the Shadow Me application
-- To restore, run this file against a PostgreSQL database

BEGIN;

-- Disable triggers
SET session_replication_role = replica;

-- Drop tables if they exist (in reverse order to avoid constraint violations)
`;
    
    // Add drop statements in reverse order
    [...tables].reverse().forEach(table => {
      backupSQL += `DROP TABLE IF EXISTS "${table}" CASCADE;\n`;
    });
    
    backupSQL += '\n';
    
    // Add create table statements
    backupSQL += '-- Create tables\n';
    
    // Group schema data by table
    const tableSchemas = {};
    schemaData.forEach(col => {
      if (!tableSchemas[col.table_name]) {
        tableSchemas[col.table_name] = [];
      }
      tableSchemas[col.table_name].push(col);
    });
    
    // Group constraint data by table
    const tableConstraints = {};
    constraintData.forEach(constraint => {
      if (!tableConstraints[constraint.table_name]) {
        tableConstraints[constraint.table_name] = [];
      }
      tableConstraints[constraint.table_name].push(constraint);
    });
    
    // Generate create statements
    for (const table of tables) {
      backupSQL += `\nCREATE TABLE "${table}" (\n`;
      
      // Add columns
      const columns = tableSchemas[table] || [];
      const columnDefs = columns.map(col => {
        let colDef = `  "${col.column_name}" ${col.data_type}`;
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        return colDef;
      });
      
      // Add primary key constraints
      const constraints = tableConstraints[table] || [];
      const pkConstraints = constraints.filter(c => c.constraint_type === 'PRIMARY KEY');
      if (pkConstraints.length > 0) {
        // Group by constraint name to handle composite primary keys
        const pkGroups = {};
        pkConstraints.forEach(pk => {
          if (!pkGroups[pk.constraint_name]) {
            pkGroups[pk.constraint_name] = [];
          }
          pkGroups[pk.constraint_name].push(pk.column_name);
        });
        
        for (const [constraintName, columns] of Object.entries(pkGroups)) {
          const pkDef = `  PRIMARY KEY (${columns.map(c => `"${c}"`).join(', ')})`;
          columnDefs.push(pkDef);
        }
      }
      
      backupSQL += columnDefs.join(',\n');
      backupSQL += '\n);\n';
    }
    
    // Add foreign key constraints separately
    backupSQL += '\n-- Add foreign key constraints\n';
    for (const table of tables) {
      const constraints = tableConstraints[table] || [];
      const fkConstraints = constraints.filter(c => c.constraint_type === 'FOREIGN KEY');
      
      for (const fk of fkConstraints) {
        backupSQL += `ALTER TABLE "${table}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES "${fk.foreign_table_name}" ("${fk.foreign_column_name}");\n`;
      }
    }
    
    // Add index creation commands
    backupSQL += '\n-- Create indices for performance\n';
    for (const table of tables) {
      // Create indices on foreign key columns
      const constraints = tableConstraints[table] || [];
      const fkConstraints = constraints.filter(c => c.constraint_type === 'FOREIGN KEY');
      
      for (const fk of fkConstraints) {
        backupSQL += `CREATE INDEX IF NOT EXISTS "idx_${table}_${fk.column_name}" ON "${table}" ("${fk.column_name}");\n`;
      }
    }
    
    // Now add data from each table
    backupSQL += '\n-- Insert data\n';
    
    for (const table of tables) {
      console.log(chalk.cyan(`Extracting data from table: ${table}...`));
      
      const { data: rowCount, error: countError } = await supabase.rpc('pg_execute', {
        query: `SELECT COUNT(*) as count FROM "${table}"`
      });
      
      if (countError) {
        console.warn(chalk.yellow(`⚠️ Error counting rows in table ${table}:`, countError));
        continue;
      }
      
      const count = parseInt(rowCount[0].count);
      if (count === 0) {
        console.log(chalk.yellow(`  Table ${table} is empty, skipping...`));
        continue;
      }
      
      console.log(chalk.cyan(`  Found ${count} rows in table ${table}`));
      
      // Get the column names
      const columns = tableSchemas[table] || [];
      const columnNames = columns.map(col => col.column_name);
      
      // Fetch the data in batches
      const batchSize = 1000;
      const batches = Math.ceil(count / batchSize);
      
      backupSQL += `\n-- Data for table "${table}" (${count} rows)\n`;
      
      for (let batch = 0; batch < batches; batch++) {
        const offset = batch * batchSize;
        const { data: rows, error: dataError } = await supabase.rpc('pg_execute', {
          query: `SELECT * FROM "${table}" LIMIT ${batchSize} OFFSET ${offset}`
        });
        
        if (dataError) {
          console.warn(chalk.yellow(`⚠️ Error fetching data from table ${table}:`, dataError));
          continue;
        }
        
        // Generate insert statements
        for (const row of rows) {
          const values = columnNames.map(col => {
            const value = row[col];
            if (value === null) {
              return 'NULL';
            } else if (typeof value === 'string') {
              // Escape single quotes and backslashes
              return `'${value.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
            } else if (value instanceof Date) {
              return `'${value.toISOString()}'`;
            } else if (typeof value === 'object') {
              return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
            } else {
              return value;
            }
          });
          
          backupSQL += `INSERT INTO "${table}" (${columnNames.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
      }
    }
    
    // Add final statements
    backupSQL += `
-- Reset sequences (if any)
`;

    for (const seq of sequenceData) {
      backupSQL += `SELECT setval('${seq.sequence_name}', COALESCE((SELECT MAX(id) FROM ${seq.sequence_name.replace('_id_seq', '')}), 1), false);\n`;
    }

    backupSQL += `
-- Enable triggers
SET session_replication_role = default;

COMMIT;
`;
    
    // Write the backup to file
    fs.writeFileSync(outputFilePath, backupSQL);
    
    console.log(chalk.green(`✅ Database backup created successfully at: ${outputFilePath}`));
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Failed to create database backup:'), error);
    process.exit(1);
  }
}

createDatabaseBackup();