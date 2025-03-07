import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

// Get environment variables with fallbacks for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Validate that environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing. Please check your .env file.');
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    // Add global error handler
    global: {
      fetch: (...args) => {
        return fetch(...args);
      }
    }
  }
);

// Initialize database connection check
export const checkDatabaseConnection = async () => {
  try {
    // Try a simple query to check connection
    const { error } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Database connection error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected database error:', err);
    return false;
  }
};

// Check connection
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
  } else if (event === 'SIGNED_IN') {
    console.log('User signed in');
  }
});