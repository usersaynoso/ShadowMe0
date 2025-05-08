import fs from 'fs';
import pg from 'pg';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('Running migration: Add users_metadata table');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to the database');
    
    // Read the SQL migration file
    const sqlPath = join(__dirname, '0005_add_users_metadata.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the connection
    await client.end();
  }
}

runMigration(); 