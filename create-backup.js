import 'dotenv/config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createBackup() {
  console.log('📦 Creating database backup...');

  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable must be set.');
    process.exit(1);
  }

  // Extract db connection details from DATABASE_URL
  // Format: postgresql://user:password@host:port/dbname
  const url = new URL(databaseUrl);
  const dbname = url.pathname.slice(1); // remove leading slash
  const user = url.username;
  const password = url.password;
  const host = url.hostname;
  const port = url.port || '5432';

  // Set environment variables for pg_dump
  const env = {
    ...process.env,
    PGPASSWORD: password
  };

  // Output file path
  const outputFilePath = path.resolve(__dirname, 'DATABASE.sql');

  console.log(`🔍 Dumping database schema and data to ${outputFilePath}...`);

  // Create pg_dump command
  const pg_dump = spawn('pg_dump', [
    '-h', host,
    '-p', port,
    '-U', user,
    '-d', dbname,
    '--clean',
    '--if-exists',
    '--no-owner',
    '-f', outputFilePath
  ], { env });

  // Handle errors and completion
  pg_dump.stderr.on('data', (data) => {
    console.error(`⚠️ pg_dump stderr: ${data}`);
  });

  pg_dump.on('error', (error) => {
    if (error.code === 'ENOENT') {
      console.error('❌ pg_dump command not found. Please install PostgreSQL client tools.');
    } else {
      console.error(`❌ pg_dump error: ${error.message}`);
    }
    process.exit(1);
  });

  pg_dump.on('close', (code) => {
    if (code === 0) {
      console.log(`✅ Database backup created successfully at: ${outputFilePath}`);
    } else {
      console.error(`❌ pg_dump process exited with code ${code}`);
      // Create a simplified backup file with just a comment if pg_dump fails
      try {
        fs.writeFileSync(outputFilePath, 
`-- Shadow Me Database Backup - PLACEHOLDER
-- Generated on: ${new Date().toISOString()}
-- 
-- Note: Automatic backup using pg_dump failed.
-- This is a placeholder file. Please manually backup the database.
--
-- Database URL: ${databaseUrl.replace(/:[^:\/]+@/, ':***@')}
`);
        console.log(`⚠️ Created placeholder backup file at: ${outputFilePath}`);
      } catch (err) {
        console.error(`❌ Failed to create placeholder backup: ${err.message}`);
      }
    }
  });
}

createBackup();