import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (import.meta.env.VITE_USE_SUPABASE === 'true') {
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required when VITE_USE_SUPABASE=true');
  if (!supabaseKey) throw new Error('VITE_SUPABASE_ANON_KEY is required when VITE_USE_SUPABASE=true');
}

function createStubClient(): SupabaseClient {
  const handler: ProxyHandler<object> = {
    get() {
      throw new Error(
        'Supabase client is not initialized. Set VITE_USE_SUPABASE=true and provide VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.',
      );
    },
  };
  return new Proxy({}, handler) as SupabaseClient;
}

export const supabase: SupabaseClient =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : createStubClient();
