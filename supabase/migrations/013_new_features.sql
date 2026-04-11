-- ============================================================
-- 013: chat_messages, CRM, 受発注, 請求書, 入退場, 安全書類,
--      KY活動, ヒヤリハット, 変更指示, セレクション, ムードボード, 図面ピン
-- ============================================================

-- ── Helper macro (org membership) used in RLS policies ────────
-- organization_id in (select om.organization_id from public.organization_members om where om.user_id = auth.uid())

-- ============================================================
-- 1. chat_messages
-- ============================================================
create table if not exists public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  room_id         text not null,
  sender_id       uuid,
  sender_name     text,
  body            text not null default '',
  message_type    text not null default 'text'
    check (message_type in ('text', 'image', 'file', 'system')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists chat_messages_project_id_idx      on public.chat_messages (project_id);
create index if not exists chat_messages_organization_id_idx on public.chat_messages (organization_id);
create index if not exists chat_messages_room_id_idx         on public.chat_messages (room_id);

drop trigger if exists set_chat_messages_updated_at on public.chat_messages;
create trigger set_chat_messages_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

alter table public.chat_messages enable row level security;

drop policy if exists "org members can manage chat messages" on public.chat_messages;
create policy "org members can manage chat messages"
on public.chat_messages for all to authenticated
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

-- ============================================================
-- 2. customers (CRM)
-- ============================================================
create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  company         text,
  email           text,
  phone           text,
  address         text,
  notes           text,
  status          text not null default 'active'
    check (status in ('active', 'inactive', 'prospect')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists customers_organization_id_idx on public.customers (organization_id);
create index if not exists customers_project_id_idx      on public.customers (project_id);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

alter table public.customers enable row level security;

drop policy if exists "org members can manage customers" on public.customers;
create policy "org members can manage customers"
on public.customers for all to authenticated
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

-- ============================================================
-- 3. deals (CRM商談)
-- ============================================================
create table if not exists public.deals (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null,
  title           text not null,
  amount          numeric(12,2),
  stage           text not null default 'prospect'
    check (stage in ('prospect', 'proposal', 'negotiation', 'won', 'lost')),
  expected_close  date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists deals_organization_id_idx on public.deals (organization_id);
create index if not exists deals_project_id_idx      on public.deals (project_id);
create index if not exists deals_customer_id_idx     on public.deals (customer_id);

drop trigger if exists set_deals_updated_at on public.deals;
create trigger set_deals_updated_at
before update on public.deals
for each row execute function public.set_updated_at();

alter table public.deals enable row level security;

drop policy if exists "org members can manage deals" on public.deals;
create policy "org members can manage deals"
on public.deals for all to authenticated
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

-- ============================================================
-- 4. purchase_orders (受発注)
-- ============================================================
create table if not exists public.purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_name   text not null,
  order_number    text,
  status          text not null default 'draft'
    check (status in ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  order_date      date,
  expected_date   date,
  total_amount    numeric(12,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists purchase_orders_organization_id_idx on public.purchase_orders (organization_id);
create index if not exists purchase_orders_project_id_idx      on public.purchase_orders (project_id);

drop trigger if exists set_purchase_orders_updated_at on public.purchase_orders;
create trigger set_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

alter table public.purchase_orders enable row level security;

drop policy if exists "org members can manage purchase orders" on public.purchase_orders;
create policy "org members can manage purchase orders"
on public.purchase_orders for all to authenticated
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

-- ============================================================
-- 5. invoices (請求書管理)
-- ============================================================
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_number  text,
  customer_id     uuid references public.customers(id) on delete set null,
  status          text not null default 'draft'
    check (status in ('draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled')),
  issue_date      date,
  due_date        date,
  subtotal        numeric(12,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total_amount    numeric(12,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists invoices_organization_id_idx on public.invoices (organization_id);
create index if not exists invoices_project_id_idx      on public.invoices (project_id);
create index if not exists invoices_customer_id_idx     on public.invoices (customer_id);
create index if not exists invoices_status_idx          on public.invoices (status);

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;

drop policy if exists "org members can manage invoices" on public.invoices;
create policy "org members can manage invoices"
on public.invoices for all to authenticated
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

-- ============================================================
-- 6. site_entry_records (入退場記録)
-- ============================================================
create table if not exists public.site_entry_records (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  worker_name     text not null,
  company_name    text,
  entry_at        timestamptz,
  exit_at         timestamptz,
  entry_type      text not null default 'entry'
    check (entry_type in ('entry', 'exit')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists site_entry_records_organization_id_idx on public.site_entry_records (organization_id);
create index if not exists site_entry_records_project_id_idx      on public.site_entry_records (project_id);
create index if not exists site_entry_records_entry_at_idx        on public.site_entry_records (entry_at);

drop trigger if exists set_site_entry_records_updated_at on public.site_entry_records;
create trigger set_site_entry_records_updated_at
before update on public.site_entry_records
for each row execute function public.set_updated_at();

alter table public.site_entry_records enable row level security;

drop policy if exists "org members can manage site entry records" on public.site_entry_records;
create policy "org members can manage site entry records"
on public.site_entry_records for all to authenticated
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

-- ============================================================
-- 7. safety_documents (安全書類)
-- ============================================================
create table if not exists public.safety_documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  document_type   text not null default 'other'
    check (document_type in ('risk_assessment', 'safety_plan', 'toolbox_talk', 'inspection', 'other')),
  url             text,
  version         text,
  approved_by     text,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists safety_documents_organization_id_idx on public.safety_documents (organization_id);
create index if not exists safety_documents_project_id_idx      on public.safety_documents (project_id);

drop trigger if exists set_safety_documents_updated_at on public.safety_documents;
create trigger set_safety_documents_updated_at
before update on public.safety_documents
for each row execute function public.set_updated_at();

alter table public.safety_documents enable row level security;

drop policy if exists "org members can manage safety documents" on public.safety_documents;
create policy "org members can manage safety documents"
on public.safety_documents for all to authenticated
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

-- ============================================================
-- 8. ky_activities (KY活動)
-- ============================================================
create table if not exists public.ky_activities (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_date   date not null default current_date,
  leader_name     text,
  hazards         text,
  countermeasures text,
  target_zero     text,
  participants    jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists ky_activities_organization_id_idx  on public.ky_activities (organization_id);
create index if not exists ky_activities_project_id_idx       on public.ky_activities (project_id);
create index if not exists ky_activities_activity_date_idx    on public.ky_activities (activity_date);

drop trigger if exists set_ky_activities_updated_at on public.ky_activities;
create trigger set_ky_activities_updated_at
before update on public.ky_activities
for each row execute function public.set_updated_at();

alter table public.ky_activities enable row level security;

drop policy if exists "org members can manage ky activities" on public.ky_activities;
create policy "org members can manage ky activities"
on public.ky_activities for all to authenticated
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

-- ============================================================
-- 9. near_miss_reports (ヒヤリハット)
-- ============================================================
create table if not exists public.near_miss_reports (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occurred_at     timestamptz not null default now(),
  location        text,
  description     text not null default '',
  cause           text,
  countermeasure  text,
  severity        text not null default 'low'
    check (severity in ('low', 'medium', 'high')),
  reporter_name   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists near_miss_reports_organization_id_idx on public.near_miss_reports (organization_id);
create index if not exists near_miss_reports_project_id_idx      on public.near_miss_reports (project_id);
create index if not exists near_miss_reports_occurred_at_idx     on public.near_miss_reports (occurred_at);

drop trigger if exists set_near_miss_reports_updated_at on public.near_miss_reports;
create trigger set_near_miss_reports_updated_at
before update on public.near_miss_reports
for each row execute function public.set_updated_at();

alter table public.near_miss_reports enable row level security;

drop policy if exists "org members can manage near miss reports" on public.near_miss_reports;
create policy "org members can manage near miss reports"
on public.near_miss_reports for all to authenticated
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

-- ============================================================
-- 10. change_requests (変更指示)
-- ============================================================
create table if not exists public.change_requests (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  description     text,
  requested_by    text,
  status          text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'implemented')),
  cost_impact     numeric(12,2),
  schedule_impact integer,
  approved_by     text,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists change_requests_organization_id_idx on public.change_requests (organization_id);
create index if not exists change_requests_project_id_idx      on public.change_requests (project_id);
create index if not exists change_requests_status_idx          on public.change_requests (status);

drop trigger if exists set_change_requests_updated_at on public.change_requests;
create trigger set_change_requests_updated_at
before update on public.change_requests
for each row execute function public.set_updated_at();

alter table public.change_requests enable row level security;

drop policy if exists "org members can manage change requests" on public.change_requests;
create policy "org members can manage change requests"
on public.change_requests for all to authenticated
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

-- ============================================================
-- 11. selection_items (施主セレクション)
-- ============================================================
create table if not exists public.selection_items (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category        text not null,
  item_name       text not null,
  description     text,
  options         jsonb not null default '[]',
  selected_option text,
  deadline        date,
  status          text not null default 'pending'
    check (status in ('pending', 'decided', 'ordered', 'installed')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists selection_items_organization_id_idx on public.selection_items (organization_id);
create index if not exists selection_items_project_id_idx      on public.selection_items (project_id);
create index if not exists selection_items_status_idx          on public.selection_items (status);

drop trigger if exists set_selection_items_updated_at on public.selection_items;
create trigger set_selection_items_updated_at
before update on public.selection_items
for each row execute function public.set_updated_at();

alter table public.selection_items enable row level security;

drop policy if exists "org members can manage selection items" on public.selection_items;
create policy "org members can manage selection items"
on public.selection_items for all to authenticated
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

-- ============================================================
-- 12. mood_boards (ムードボード)
-- ============================================================
create table if not exists public.mood_boards (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title           text not null,
  description     text,
  items           jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists mood_boards_organization_id_idx on public.mood_boards (organization_id);
create index if not exists mood_boards_project_id_idx      on public.mood_boards (project_id);

drop trigger if exists set_mood_boards_updated_at on public.mood_boards;
create trigger set_mood_boards_updated_at
before update on public.mood_boards
for each row execute function public.set_updated_at();

alter table public.mood_boards enable row level security;

drop policy if exists "org members can manage mood boards" on public.mood_boards;
create policy "org members can manage mood boards"
on public.mood_boards for all to authenticated
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

-- ============================================================
-- 13. drawing_pins (図面ピン)
-- ============================================================
create table if not exists public.drawing_pins (
  id              uuid primary key default gen_random_uuid(),
  project_id      text references public.projects(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  drawing_url     text,
  label           text,
  pin_type        text not null default 'issue'
    check (pin_type in ('issue', 'comment', 'task', 'punch', 'other')),
  x_ratio         numeric(5,4) not null default 0,
  y_ratio         numeric(5,4) not null default 0,
  page_number     integer not null default 1,
  resolved        boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists drawing_pins_organization_id_idx on public.drawing_pins (organization_id);
create index if not exists drawing_pins_project_id_idx      on public.drawing_pins (project_id);
create index if not exists drawing_pins_resolved_idx        on public.drawing_pins (resolved);

drop trigger if exists set_drawing_pins_updated_at on public.drawing_pins;
create trigger set_drawing_pins_updated_at
before update on public.drawing_pins
for each row execute function public.set_updated_at();

alter table public.drawing_pins enable row level security;

drop policy if exists "org members can manage drawing pins" on public.drawing_pins;
create policy "org members can manage drawing pins"
on public.drawing_pins for all to authenticated
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
