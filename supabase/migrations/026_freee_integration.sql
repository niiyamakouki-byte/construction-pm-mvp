-- freee 連携テーブル
CREATE TABLE freee_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  freee_company_id BIGINT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, freee_company_id)
);

CREATE TABLE freee_deals_cache (
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

CREATE TABLE invoice_freee_matches (
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

-- RLS
ALTER TABLE freee_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE freee_deals_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_freee_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY freee_connections_org ON freee_connections FOR ALL
  USING (organization_id = auth_org_id());
CREATE POLICY freee_deals_cache_org ON freee_deals_cache FOR ALL
  USING (organization_id = auth_org_id());
CREATE POLICY invoice_freee_matches_org ON invoice_freee_matches FOR ALL
  USING (organization_id = auth_org_id());

CREATE INDEX idx_freee_deals_cache_amount ON freee_deals_cache(organization_id, amount, issue_date);
CREATE INDEX idx_freee_deals_cache_partner ON freee_deals_cache(organization_id, partner_name);
