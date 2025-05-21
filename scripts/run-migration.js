#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

// Path to migration files
const migrationDir = path.join(__dirname, '..', 'migrations');
const schemaFixFile = path.join(migrationDir, 'schema_fix.sql');
const completeMigrationFile = path.join(migrationDir, 'complete_migration.sql');
const tempSqlFile = path.join(migrationDir, 'temp_migration.sql');

// Function to run a SQL migration file
async function runSqlFile(sqlFile) {
  return new Promise((resolve, reject) => {
    try {
      if (!fs.existsSync(sqlFile)) {
        console.error(`ERROR: Migration file not found: ${sqlFile}`);
        return reject(new Error(`Migration file not found: ${sqlFile}`));
      }

      // Read migration SQL
      const sql = fs.readFileSync(sqlFile, 'utf8');
      
      // Write to a temporary file
      fs.writeFileSync(tempSqlFile, sql);

      // Construct command to run SQL using the file rather than passing it directly
      const command = `psql "${DATABASE_URL}" -f "${tempSqlFile}"`;

      // Execute command
      exec(command, (error, stdout, stderr) => {
        // Clean up temp file
        try {
          fs.unlinkSync(tempSqlFile);
        } catch (err) {
          console.warn('Warning: Failed to clean up temporary SQL file:', err);
        }
        
        if (error) {
          console.error(`ERROR: Failed to run migration: ${sqlFile}`);
          console.error(error);
          return reject(error);
        }

        if (stderr && !stderr.includes('NOTICE')) {
          console.error('Migration warnings/errors:');
          console.error(stderr);
        } else if (stderr) {
          // PostgreSQL NOTICE messages come through stderr but aren't errors
          console.log('Migration messages:');
          console.log(stderr);
        }

        console.log('Migration output:');
        console.log(stdout);
        console.log(`Migration ${path.basename(sqlFile)} completed successfully`);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Function to run all migrations
async function runMigrations() {
  console.log('Starting database schema migrations...');

  try {
    // Run schema_fix.sql first
    console.log('Running schema_fix.sql...');
    await runSqlFile(schemaFixFile);
    
    // Then run complete_migration.sql to finish the job
    console.log('\nRunning complete_migration.sql...');
    await runSqlFile(completeMigrationFile);
    
    console.log('\nAll migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

// Run the migrations
runMigrations().catch(error => {
  console.error('Unexpected error during migration:', error);
  process.exit(1);
}); 