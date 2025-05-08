import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set.');
  process.exit(1);
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Create a connection string for Drizzle from Supabase credentials
// Format: postgres://postgres:[PASSWORD]@[HOST]/postgres
export const getDatabaseUrl = () => {
  // Extract host from supabaseUrl (remove https:// prefix)
  const host = new URL(supabaseUrl).hostname;
  
  // Create the connection string
  // The password is the service key
  return `postgres://postgres:${supabaseKey}@${host}/postgres`;
}; 