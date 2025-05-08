import { createClient } from '@supabase/supabase-js';

// Read Supabase credentials from environment variables
// For client-side, these must be public variables with VITE_ prefix
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Authentication with Supabase may not work.');
}

// Create a Supabase client
export const supabase = createClient(
  supabaseUrl || '', 
  supabaseAnonKey || ''
); 