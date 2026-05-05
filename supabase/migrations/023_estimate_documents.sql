-- ============================================================
-- P0-4: 見積書ドキュメントテーブル
-- public.estimates は明細行単位のため、見積書単位の別テーブルを追加する。
-- EstimateRepository (Phase C) はこのテーブルを使用する。
-- ============================================================

create table if not exists public.estimate_documents (
  id              text primary key,
  project_id      text not null references public.projects(id) on delete cascade,
  organization_id uuid references public.organizations on delete cascade,
  property_name   text not null default '',
  client_name     text not null default '',
  total_amount    numeric(14, 2) not null default 0,
  tax_rate        numeric(5, 4) not null default 0.10,
  status          text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'rejected')),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

-- インデックス
create index if not exists estimate_documents_project_id_idx   on public.estimate_documents (project_id);
create index if not exists estimate_documents_org_id_idx       on public.estimate_documents (organization_id);
create index if not exists estimate_documents_status_idx       on public.estimate_documents (status);

-- updated_at トリガー (set_updated_at は 001 で定義済み)
drop trigger if exists set_estimate_documents_updated_at on public.estimate_documents;
create trigger set_estimate_documents_updated_at
before update on public.estimate_documents
for each row execute function public.set_updated_at();

-- RLS
alter table public.estimate_documents enable row level security;

create policy "org members can manage estimate documents"
on public.estimate_documents for all to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid()
  )
)
with check (
  organization_id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid()
  )
);
