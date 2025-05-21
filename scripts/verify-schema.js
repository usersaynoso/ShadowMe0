#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import pg from 'pg';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const IMPORTANT_TABLES = [
  'users',
  'profiles',
  'notifications',
  'chat_rooms',
  'messages',
  'posts',
  'friends'
];

async function verifySchema() {
  console.log('Verifying database schema...');

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // Create a PostgreSQL client
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // List all tables
    const tableResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables = tableResult.rows.map(row => row.table_name);
    
    console.log(`\nFound ${tables.length} tables:`);
    console.log(tables.join(', '));
    
    // Check for important tables
    const missingTables = IMPORTANT_TABLES.filter(table => !tables.includes(table));
    if (missingTables.length > 0) {
      console.error(`\n❌ MISSING IMPORTANT TABLES: ${missingTables.join(', ')}`);
    } else {
      console.log(`\n✅ All important tables exist`);
    }

    // Check the notifications table schema specifically
    console.log('\nChecking notifications table schema:');
    const columnResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);

    if (columnResult.rows.length === 0) {
      console.error('❌ Notifications table exists but has no columns!');
    } else {
      console.log('\nNotifications table columns:');
      columnResult.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
      
      // Check for specific columns
      const columnNames = columnResult.rows.map(col => col.column_name);
      const requiredColumns = ['notification_id', 'recipient_user_id', 'actor_user_id', 'event_type', 'entity_id', 'entity_type', 'created_at', 'is_read'];
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      if (missingColumns.length > 0) {
        console.error(`\n❌ Missing required columns in notifications table: ${missingColumns.join(', ')}`);
      } else {
        console.log(`\n✅ All required columns exist in notifications table`);
      }
      
      // Check for old schema columns that should have been migrated
      const oldColumns = ['user_id', 'sender_user_id', 'type', 'related_item_id'];
      const remainingOldColumns = oldColumns.filter(col => columnNames.includes(col));
      
      if (remainingOldColumns.length > 0) {
        console.warn(`\n⚠️ Old schema columns still present in notifications table: ${remainingOldColumns.join(', ')}`);
      } else {
        console.log(`\n✅ No old schema columns remain in notifications table`);
      }
    }

    console.log('\nSchema verification completed');
  } catch (error) {
    console.error('Error verifying schema:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
    process.exit(0);
  }
}

verifySchema(); 