#!/usr/bin/env node

// This script pushes the database schema to Supabase
// It uses Drizzle Kit to generate and apply migrations

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure we're in the project root
process.chdir(join(__dirname, '..'));

console.log('🚀 Starting database migration to Supabase...');
console.log('📊 Generating schema migrations...');

// Run Drizzle Kit to push schema changes
const drizzleProcess = spawn('npx', ['drizzle-kit', 'push:pg'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // We use the DATABASE_URL from env variables
  }
});

drizzleProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Schema migration failed. Please check the error message above.');
    process.exit(code);
  }
  
  console.log('✅ Database schema has been migrated to Supabase successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Add seed data for emotions if needed');
  console.log('2. Verify database connection in your application');
  console.log('3. Update your environment variables to use Supabase in production');
});