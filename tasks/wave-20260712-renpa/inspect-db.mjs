// wave-20260712-renpa: 本番DBの読み取り調査（projects/documents/contract_checklists有無）
// 作成者: Claude worker (genbahub wave 2026-07-12) — 読み取り専用
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envText = readFileSync('/Users/koki/construction-pm-mvp/.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: projects, error: pErr } = await admin.from('projects').select('id,name,status').order('created_at', { ascending: false }).limit(20);
console.log('--- projects', pErr?.message || '');
for (const p of projects || []) console.log(p.id, '|', p.status, '|', p.name);

const { data: docs, error: dErr } = await admin.from('documents').select('id,project_id,title,created_at').order('created_at', { ascending: false }).limit(20);
console.log('--- documents', dErr?.message || '');
for (const d of docs || []) console.log(d.id, '|', d.project_id, '|', d.title);

const { error: cErr } = await admin.from('contract_checklists').select('id').limit(1);
console.log('--- contract_checklists:', cErr ? 'ERROR: ' + cErr.message : 'table exists');

const { data: users } = await admin.auth.admin.listUsers({ perPage: 50 });
console.log('--- users:', (users?.users || []).map(u => u.email).join(', '));
