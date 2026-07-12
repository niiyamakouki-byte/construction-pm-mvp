// wave-20260712-renpa: 本番監査アカウントのmagiclink発行（公開準備検証用）
// 作成者: Claude worker (genbahub wave 2026-07-12)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envText = readFileSync('/Users/koki/construction-pm-mvp/.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const email = process.argv[2] || 'niiyama+audit20260712@laporta.co.jp';
const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo: 'https://construction-pm-mvp.vercel.app/' },
});
if (error) {
  console.error('FAIL:', error.message);
  process.exit(1);
}
console.log(data.properties?.action_link);
