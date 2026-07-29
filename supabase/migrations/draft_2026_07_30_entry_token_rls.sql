-- Migration: QR入場 entry_token 方式 (Phase 2/2: RLS + anon 用 organization_id 自動補完)
-- 作成のみ（適用禁止）。本番適用は光輝さんGO後に司令塔が実施する。
-- 前提: draft_2026_07_30_project_entry_token.sql が本ファイルより先に適用済みであること。
--
-- 対象 (laporta-beads-g6sf):
-- 1) site_entry_records の anon INSERT/UPDATE ポリシーが EXISTS(projects) に依存し、
--    anonからprojectsが不可視のため常に42501で拒否される問題を、
--    projects.entry_token とのトークン一致判定に切替えて解消する。
-- 2) site_entry_records.organization_id は not null 制約付きだが、anonは
--    projects/organizations のいずれも読めないため、アプリコード側の
--    resolveOrganizationId() (SiteEntryRepository.ts) は anon 経路では常に null を
--    返す。token検証を通過したINSERTに限り、DB側トリガーでorganization_idを
--    自動補完することで、anon経路でも23502(not-null violation)を回避する。
--
-- 変更しないもの (acceptance criteria 4 準拠):
-- - anon_select_site_entry (entry_at::date = current_date のみ) は変更しない。
--   projectsに依存していないため今回のRLSギャップの対象外であり、既存の
--   today-log表示・insert/update後のPostgREST再SELECTを壊さないため据え置く。
-- - photos テーブルの anon ポリシーは対象外(PhotoRepository は現状インメモリのみで
--   Supabase未経由のため、実際に機能していない設計途中のポリシー。今回のQR入場anon
--   書込みフローには影響しないため触らない)。

-- ── site_entry_records: 提出されたtokenを保持する列 ──────────────────────────
-- クライアントはQRに埋め込まれた現在の projects.entry_token を送信し、この列に
-- 保存する。RLS判定にのみ使う値で、業務上の意味は持たない(「どのtokenで記録され
-- たか」の監査証跡として残しておく)。
alter table public.site_entry_records
  add column if not exists entry_token text;

-- ── token検証関数 (SECURITY DEFINER) ─────────────────────────────────────────
-- anon は projects を直接SELECTできないため、RLSポリシー内の
-- EXISTS(SELECT ... FROM projects ...) は anon の可視性で評価され常にfalseになる
-- (これがg6sfの根本原因)。SECURITY DEFINER関数でRLSをバイパスし、
-- 「project_id と token の組が有効か」だけを検証する狭いインターフェースにする
-- (projects の他カラムは一切返さない)。
create or replace function public.verify_project_entry_token(p_project_id text, p_token text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id
      and entry_token is not null
      and entry_token = p_token
  );
$$;

revoke all on function public.verify_project_entry_token(text, text) from public;
grant execute on function public.verify_project_entry_token(text, text) to anon, authenticated;

-- ── organization_id 自動補完トリガー (SECURITY DEFINER) ──────────────────────
-- token検証を通過したINSERTに限り、DB側でorganization_idを補完する
-- (anonはprojects/organizationsのいずれも読めないためアプリコード側では解決不能)。
-- NEW.organization_id が既に設定されている場合(authenticated経路で
-- resolveOrganizationId()が解決できた場合)は何もしない。
create or replace function public.site_entry_records_fill_organization_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    select organization_id into new.organization_id
    from public.projects
    where id = new.project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists site_entry_records_fill_organization_id on public.site_entry_records;
create trigger site_entry_records_fill_organization_id
before insert on public.site_entry_records
for each row execute function public.site_entry_records_fill_organization_id();

-- ── anon RLS ポリシー: projects への EXISTS 依存を撤廃し token 検証に切替 ─────
drop policy if exists "anon_insert_site_entry" on public.site_entry_records;
create policy "anon_insert_site_entry" on public.site_entry_records
  for insert
  to anon
  with check (
    public.verify_project_entry_token(project_id, entry_token)
  );

drop policy if exists "anon_update_site_entry" on public.site_entry_records;
create policy "anon_update_site_entry" on public.site_entry_records
  for update
  to anon
  using (
    entry_at::date = current_date
    and public.verify_project_entry_token(project_id, entry_token)
  )
  with check (
    public.verify_project_entry_token(project_id, entry_token)
  );

-- ── 本番適用手順 (owner GO後に司令塔が実行。今回は作成のみで未実行) ───────────
-- 前提: draft_2026_07_30_project_entry_token.sql を先に適用しておくこと。
-- SB_PW="$(cat /tmp/sb_pw_dec.txt)" npx -y -p pg node -e "
--   const { readFileSync } = require('node:fs');
--   const pg = require('pg');
--   const client = new pg.Client({
--     host: 'aws-1-ap-northeast-1.pooler.supabase.com', port: 5432, database: 'postgres',
--     user: 'postgres.iumymkvhrqwfexlthplm', password: process.env.SB_PW.trim(), ssl: true,
--   });
--   (async () => {
--     await client.connect();
--     await client.query(readFileSync('supabase/migrations/draft_2026_07_30_entry_token_rls.sql', 'utf8'));
--     console.log('applied');
--     await client.end();
--   })();
-- "
--
-- 適用後の裏取りSQL (service_role key推奨):
--   select id, entry_token is not null as has_token from public.projects;
--   select policyname, cmd, roles from pg_policies
--     where schemaname='public' and tablename='site_entry_records' and 'anon' = any(roles);
--   -- anon keyでの実INSERT検証は entry-anon-e2e.mjs 等を使い、
--   -- QRに埋め込まれた現行token(projects.entry_token)をURLの ?token= に付与して実行する。
