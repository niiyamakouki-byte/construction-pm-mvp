import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (import.meta.env.VITE_USE_SUPABASE === 'true') {
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required when VITE_USE_SUPABASE=true');
  if (!supabaseKey) throw new Error('VITE_SUPABASE_ANON_KEY is required when VITE_USE_SUPABASE=true');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
