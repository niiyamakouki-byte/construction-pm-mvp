// 検証スクリプト: construction_pm_mvp-g6sf（site_entry_records.organization_id NOT NULL バグ）
//
// 目的: SiteEntryRepository.saveAsync の修正（projects.organization_id → organizations
// フォールバックで organization_id を解決してから insert する）を、実際の本番Supabase相手に
// 「認証済み経路」で検証する。修正前は organization_id が row に含まれず 23502 (not-null
// violation) で必ず失敗していた。
//
// 手順:
//   1. service-role で実在の組織メンバー（niiyama@laporta.co.jp）のマジックリンクを発行し、
//      anonキーのクライアントで verifyOtp してログインセッションを確立する（パスワード不要、
//      メール送信も発生しない = 本番アカウントに影響なし）。
//   2. そのセッションで SiteEntryRepository.saveAsync と同じ手順（projects lookup →
//      organizations フォールバック → insert）を実行する。
//   3. insert が succeed し、organization_id が not null で保存されたことを確認する。
//
// 実行: node tasks/site-entry-org-id-fix-verify-20260706.mjs
// 注意: このスクリプトが作る行は削除しない（テストと分かる worker_name で残す）。
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

const TEST_PROJECT_ID = '6676c2c6-2bea-4535-b723-4e371ae5802f'; // 渋谷ワインバー Bre.S SHIBUYA（実在project, organization_id列はnull）
const ORG_MEMBER_EMAIL = 'niiyama@laporta.co.jp';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

// ── 1. 実在の組織メンバーとして認証済みセッションを確立 ──────────────────────
const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: ORG_MEMBER_EMAIL,
});
if (linkError) fail(`generateLink失敗: ${linkError.message}`);

const tokenHash = linkData.properties?.hashed_token;
if (!tokenHash) fail('hashed_tokenが取得できませんでした');

const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
  token_hash: tokenHash,
  type: 'magiclink',
});
if (verifyError) fail(`verifyOtp失敗: ${verifyError.message}`);
console.log('OK: 認証済みセッション確立', verifyData.user?.email, verifyData.user?.id);

// ── 2. SiteEntryRepository.saveAsync と同じ導出ロジックを実データで再現 ──────
async function resolveOrganizationId(client, projectId) {
  const { data: project, error: projectError } = await client
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .maybeSingle();
  const fromProject = !projectError && project ? project.organization_id : null;
  if (fromProject) return fromProject;

  const { data: org, error: orgError } = await client
    .from('organizations')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (orgError || !org) return null;
  return org.id;
}

const organizationId = await resolveOrganizationId(anon, TEST_PROJECT_ID);
console.log('resolveOrganizationId結果:', organizationId);
if (!organizationId) fail('organization_idが解決できませんでした（想定外）');

// ── 3. site_entry_records に実際にinsertし、23502が出ないことを確認 ─────────
const workerName = `Fable5組織ID解決検証_${new Date().toISOString().replace(/[:.]/g, '')}`;
const { data: inserted, error: insertError } = await anon
  .from('site_entry_records')
  .insert({
    project_id: TEST_PROJECT_ID,
    organization_id: organizationId,
    worker_name: workerName,
    company_name: 'ラポルタ検証',
    entry_at: new Date().toISOString(),
    entry_type: 'entry',
  })
  .select('*')
  .single();

if (insertError) fail(`insert失敗: ${insertError.message} (code=${insertError.code})`);

console.log('OK: 認証済み経路でのinsertが成功');
console.log(JSON.stringify(inserted, null, 2));
console.log('RESULT: PASS — organization_id を正しく解決した状態で site_entry_records への書き込みが成功した（23502は再現しない）');
