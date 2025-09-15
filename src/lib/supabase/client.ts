import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase URL and anon key must be provided. Check your environment variables.'
  );
}

// Create a single supabase client for interacting with your database
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Since this is primarily a read-only app for now
  },
});

// Helper function for error handling
export function handleSupabaseError(error: any, context: string) {
  console.error(`Supabase error in ${context}:`, error);
  
  if (error?.code === 'PGRST116') {
    throw new Error('No data found');
  }
  
  if (error?.code === 'PGRST301') {
    throw new Error('Duplicate data');
  }
  
  throw new Error(error?.message || 'Database error occurred');
}
