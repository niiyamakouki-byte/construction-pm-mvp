import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient, hasSupabaseEnv } from '../../infra/supabase-client.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const fallbackSupabaseUrl = 'https://example.supabase.co';
const fallbackSupabaseKey = 'test-anon-key';

if (import.meta.env.VITE_USE_SUPABASE === 'true') {
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is required when VITE_USE_SUPABASE=true');
  if (!supabaseKey) throw new Error('VITE_SUPABASE_ANON_KEY is required when VITE_USE_SUPABASE=true');
}

// 認証セッションは主クライアント(src/infra/supabase-client.ts,
// storageKey=genbahub_auth_token)だけが保持している。このクライアントが
// 独自にセッション管理するとログイン状態を共有できず、全ての読み書きが
// anonロールで飛んで RLS に弾かれる(CRM顧客登録がサイレント全滅していた真因)。
// accessToken フックで毎リクエスト主クライアントのトークンを参照する。
// NOTE: accessToken 指定時は supabase.auth が使用不可になる(認証操作は
// 主クライアント側で行うこと)。
export const supabase = createClient(
  supabaseUrl || fallbackSupabaseUrl,
  supabaseKey || fallbackSupabaseKey,
  {
    accessToken: async () => {
      if (!hasSupabaseEnv()) return null;
      const main = await getSupabaseClient();
      const { data } = await main.auth.getSession();
      return data.session?.access_token ?? null;
    },
  },
);
