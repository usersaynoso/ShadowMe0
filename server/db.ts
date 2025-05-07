import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Check if Supabase credentials are available
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_KEY must be set. Did you forget to add these secrets?",
  );
}

// Create Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Extract connection string from Supabase
const connectionString = `${process.env.DATABASE_URL}`;

// Use postgres.js with the connection string
const client = postgres(connectionString, { max: 10 });

// Create Drizzle ORM instance with the postgres client
export const db = drizzle(client, { schema });

console.log('Connected to Supabase PostgreSQL database');
