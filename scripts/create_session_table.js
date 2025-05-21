import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Pool } = pg;

async function createSessionTable() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to database...');
    
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'create_session_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running session table migration...');
    await pool.query(sql);
    
    console.log('Session table created or verified successfully!');
  } catch (error) {
    console.error('Error creating session table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createSessionTable(); 