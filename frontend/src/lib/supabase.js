import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xlfycuhmbnzeofgnleof.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZnljdWhtYm56ZW9mZ25sZW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTY1MTAsImV4cCI6MjA5MTU3MjUxMH0.NcLXD5xzgokCnKcZv0laDMDP7ixrMqZvJNuCNQXLt3s';

// Capturer le hash AVANT que createClient() le consume via detectSessionInUrl
export const INITIAL_HASH = typeof window !== 'undefined' ? window.location.hash : '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});
