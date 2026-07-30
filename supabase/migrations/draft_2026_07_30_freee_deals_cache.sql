-- Draft Migration: freee連携テーブルの CREATE IF NOT EXISTS 安全版
-- 作成のみ（適用禁止）。本番適用は owner GO 後に行う。
--
-- 背景 (laporta-beads-mt9d5, 2026-07-30 検証ループ3周目):
--   supabase/migrations/026_freee_integration.sql に freee_connections /
--   freee_deals_cache / invoice_freee_matches の CREATE TABLE 定義が既に
--   存在するが、本番Supabase(iumymkvhrqwfexlthplm)には反映されていない
--   (/invoices/reconcile への初回セッション直接遷移で
--   "Could not find the table public.freee_deals_cache in the schema cache"
--   という生エラーが実測された)。
--   026番は plain CREATE TABLE のため、部分適用済みの場合に失敗する可能性があり、
--   安全に再実行できる IF NOT EXISTS 版をここに用意する。
--   定義は 026_freee_integration.sql と同一(スキーマの二重管理を避けるため複製のみ)。
--
-- 適用手順 (owner GO後):
--   1. 本番Supabaseで `SELECT * FROM freee_deals_cache LIMIT 1;` 等で
--      未作成を確認
--   2. このファイルを本番へ適用 (apply_migration or supabase db push)
--   3. src/lib/freee/FreeeRepository.ts の isE2EBypass 回避で再現していた
--      E2E上の詰みとは別に、実ログインユーザーでも /invoices/reconcile が
--      正常に空リストを返すことを確認

CREATE TABLE IF NOT EXISTS freee_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  freee_company_id BIGINT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, freee_company_id)
);

CREATE TABLE IF NOT EXISTS freee_deals_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  freee_deal_id BIGINT NOT NULL,
  freee_company_id BIGINT NOT NULL,
  issue_date DATE NOT NULL,
  amount BIGINT NOT NULL,
  partner_name TEXT,
  ref_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('settled','unsettled','partial')),
  raw_data JSONB,
  cached_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, freee_deal_id)
);

CREATE TABLE IF NOT EXISTS invoice_freee_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL,
  freee_deal_id BIGINT NOT NULL,
  organization_id UUID NOT NULL,
  match_score NUMERIC(3,2) NOT NULL CHECK (match_score BETWEEN 0 AND 1),
  match_reason TEXT,
  matched_by TEXT NOT NULL CHECK (matched_by IN ('auto','manual')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(invoice_id, freee_deal_id)
);

ALTER TABLE freee_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE freee_deals_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_freee_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS freee_connections_org ON freee_connections;
CREATE POLICY freee_connections_org ON freee_connections FOR ALL
  USING (organization_id = auth_org_id());

DROP POLICY IF EXISTS freee_deals_cache_org ON freee_deals_cache;
CREATE POLICY freee_deals_cache_org ON freee_deals_cache FOR ALL
  USING (organization_id = auth_org_id());

DROP POLICY IF EXISTS invoice_freee_matches_org ON invoice_freee_matches;
CREATE POLICY invoice_freee_matches_org ON invoice_freee_matches FOR ALL
  USING (organization_id = auth_org_id());

CREATE INDEX IF NOT EXISTS idx_freee_deals_cache_amount ON freee_deals_cache(organization_id, amount, issue_date);
CREATE INDEX IF NOT EXISTS idx_freee_deals_cache_partner ON freee_deals_cache(organization_id, partner_name);
