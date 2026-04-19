-- ============================================================
-- 018: procurement_materials (資材発注) +
--      purchase_orders 拡張 (items, totals, contractor, 全ステータス)
-- ============================================================

-- ── procurement_materials ────────────────────────────────────
create table if not exists public.procurement_materials (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  name            text not null,
  category        text not null default '',
  quantity        numeric(12,2) not null default 0,
  unit            text not null default '',
  status          text not null default 'unordered'
    check (status in ('unordered', 'ordered', 'delivered', 'accepted')),
  due_date        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists procurement_materials_project_id_idx
  on public.procurement_materials (project_id);
create index if not exists procurement_materials_organization_id_idx
  on public.procurement_materials (organization_id);
create index if not exists procurement_materials_status_idx
  on public.procurement_materials (status);

drop trigger if exists set_procurement_materials_updated_at on public.procurement_materials;
create trigger set_procurement_materials_updated_at
before update on public.procurement_materials
for each row execute function public.set_updated_at();

alter table public.procurement_materials enable row level security;

drop policy if exists "authenticated can manage procurement materials"
  on public.procurement_materials;
create policy "authenticated can manage procurement materials"
on public.procurement_materials for all to authenticated
using (true) with check (true);

drop policy if exists "anon can read procurement materials"
  on public.procurement_materials;
create policy "anon can read procurement materials"
on public.procurement_materials for select to anon
using (true);

-- ── purchase_orders 拡張 ─────────────────────────────────────
-- 013 で作成済みのテーブルに、受発注ページが必要とするカラムを追加。
alter table public.purchase_orders
  add column if not exists contractor_id   text,
  add column if not exists contractor_name text,
  add column if not exists items           jsonb not null default '[]',
  add column if not exists tax_amount      numeric(12,2) not null default 0,
  add column if not exists total_with_tax  numeric(12,2) not null default 0,
  add column if not exists delivery_date   date;

-- 既存の status チェック制約 (draft/ordered/partial/received/cancelled) を
-- 日本語 7 ステータスへ置き換える。app 層が status マッピングで扱う。
alter table public.purchase_orders
  drop constraint if exists purchase_orders_status_check;

alter table public.purchase_orders
  add constraint purchase_orders_status_check
  check (status in (
    '下書き', '発注済', '納品待ち', '納品済', '検収済', '請求済', '支払済',
    -- 既存行との互換のため、013 の英語値も暫定的に許容
    'draft', 'ordered', 'partial', 'received', 'cancelled'
  ));
