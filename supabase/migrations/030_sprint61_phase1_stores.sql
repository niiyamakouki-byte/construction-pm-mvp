-- ============================================================
-- 030: Sprint 61 Phase 1 — インメモリストア13個のテーブル化 + RLS
-- 対象: chat / crm / order-management / labor-tracker /
--        site-entry-log / safety-records / punch-list /
--        equipment-tracker / compliance-tracker / claim-manager /
--        permit-tracker / meeting-minutes / warranty-tracker
-- ============================================================

-- ── ユーティリティ: set_updated_at トリガーは 001 で作成済みと想定 ──

-- ────────────────────────────────────────────────────────────
-- 1. CHAT: chat_rooms / chat_messages
-- ────────────────────────────────────────────────────────────

create table if not exists public.chat_rooms (
  project_id    text primary key references public.projects(id) on delete cascade,
  last_activity timestamptz not null default timezone('utc', now()),
  created_at    timestamptz not null default timezone('utc', now())
);

create table if not exists public.chat_messages (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references public.projects(id) on delete cascade,
  user_id     text not null,
  user_name   text not null,
  content     text not null,
  type        text not null default 'text'
              check (type in ('text', 'file', 'image', 'system')),
  attachments text[] not null default '{}',
  mentions    text[] not null default '{}',
  read_by     text[] not null default '{}',
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chat_messages_project on public.chat_messages (project_id);
create index if not exists idx_chat_messages_created on public.chat_messages (created_at desc);

alter table public.chat_rooms    enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "org members can access chat rooms"    on public.chat_rooms;
drop policy if exists "org members can access chat messages" on public.chat_messages;

create policy "org members can access chat rooms"
on public.chat_rooms for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can access chat messages"
on public.chat_messages for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 2. CRM: crm_customers / crm_deals
-- ────────────────────────────────────────────────────────────

create table if not exists public.crm_customers (
  id              text primary key default gen_random_uuid()::text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  company         text not null default '',
  phone           text not null default '',
  email           text not null default '',
  address         text not null default '',
  note            text not null default '',
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create table if not exists public.crm_deals (
  id                   text primary key default gen_random_uuid()::text,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  customer_id          text not null references public.crm_customers(id) on delete cascade,
  project_name         text not null,
  stage                text not null
                       check (stage in ('引合', '現調', '見積提出', '商談中', '受注', '失注')),
  estimated_amount     numeric not null default 0,
  actual_amount        numeric,
  probability          integer not null default 0 check (probability between 0 and 100),
  expected_close_date  text not null,
  note                 text not null default '',
  created_at           timestamptz not null default timezone('utc', now()),
  updated_at           timestamptz not null default timezone('utc', now())
);

create index if not exists idx_crm_customers_org on public.crm_customers (organization_id);
create index if not exists idx_crm_deals_org     on public.crm_deals (organization_id);
create index if not exists idx_crm_deals_customer on public.crm_deals (customer_id);

alter table public.crm_customers enable row level security;
alter table public.crm_deals     enable row level security;

drop policy if exists "org members can manage crm customers" on public.crm_customers;
drop policy if exists "org members can manage crm deals"     on public.crm_deals;

create policy "org members can manage crm customers"
on public.crm_customers for all to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid()
  )
);

create policy "org members can manage crm deals"
on public.crm_deals for all to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 3. ORDER MANAGEMENT: purchase_orders / order_items / delivery_checks
-- ────────────────────────────────────────────────────────────

create table if not exists public.purchase_orders (
  id               text primary key default gen_random_uuid()::text,
  project_id       text not null references public.projects(id) on delete cascade,
  contractor_id    text not null,
  contractor_name  text not null,
  status           text not null default '下書き'
                   check (status in ('下書き','発注済','納品待ち','納品済','検収済','請求済','支払済')),
  order_date       text not null,
  delivery_date    text not null,
  total_amount     numeric not null default 0,
  tax_amount       numeric not null default 0,
  total_with_tax   numeric not null default 0,
  notes            text,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.order_items (
  id              text primary key default gen_random_uuid()::text,
  order_id        text not null references public.purchase_orders(id) on delete cascade,
  code            text not null default '',
  name            text not null,
  unit            text not null default '',
  quantity        numeric not null default 0,
  unit_price      numeric not null default 0,
  amount          numeric not null default 0
);

create table if not exists public.delivery_checks (
  order_id    text primary key references public.purchase_orders(id) on delete cascade,
  checked_at  timestamptz not null,
  checked_by  text not null,
  passed      boolean not null,
  remarks     text
);

create index if not exists idx_purchase_orders_project on public.purchase_orders (project_id);

alter table public.purchase_orders enable row level security;
alter table public.order_items      enable row level security;
alter table public.delivery_checks  enable row level security;

drop policy if exists "org members can manage purchase orders" on public.purchase_orders;
drop policy if exists "org members can manage order items"     on public.order_items;
drop policy if exists "org members can manage delivery checks" on public.delivery_checks;

create policy "org members can manage purchase orders"
on public.purchase_orders for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage order items"
on public.order_items for all to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    join public.projects p on p.id = po.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where po.id = order_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage delivery checks"
on public.delivery_checks for all to authenticated
using (
  exists (
    select 1 from public.purchase_orders po
    join public.projects p on p.id = po.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where po.id = order_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 4. LABOR TRACKER: labor_time_entries / crew_assignments
-- ────────────────────────────────────────────────────────────

create table if not exists public.labor_time_entries (
  id            text primary key default gen_random_uuid()::text,
  project_id    text not null references public.projects(id) on delete cascade,
  worker_id     text not null,
  worker_name   text not null,
  trade         text not null default '',
  hourly_rate   numeric not null default 0,
  clock_in_time timestamptz not null,
  clock_out_time timestamptz,
  crew_id       text,
  status        text not null default 'active'
                check (status in ('active', 'completed')),
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create table if not exists public.crew_assignments (
  id               text primary key default gen_random_uuid()::text,
  project_id       text not null references public.projects(id) on delete cascade,
  crew_id          text not null,
  crew_name        text not null,
  worker_id        text not null,
  worker_name      text not null,
  assignment_date  text not null,
  role             text,
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists idx_labor_entries_project on public.labor_time_entries (project_id);
create index if not exists idx_crew_assignments_project on public.crew_assignments (project_id);

alter table public.labor_time_entries enable row level security;
alter table public.crew_assignments    enable row level security;

drop policy if exists "org members can manage labor entries"    on public.labor_time_entries;
drop policy if exists "org members can manage crew assignments" on public.crew_assignments;

create policy "org members can manage labor entries"
on public.labor_time_entries for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage crew assignments"
on public.crew_assignments for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 5. SITE ENTRY LOG: site_entry_records
-- ────────────────────────────────────────────────────────────

create table if not exists public.site_entry_records (
  id          text primary key default gen_random_uuid()::text,
  project_id  text not null references public.projects(id) on delete cascade,
  worker_name text not null,
  company     text not null default '',
  entry_time  timestamptz not null default timezone('utc', now()),
  exit_time   timestamptz,
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_site_entry_project on public.site_entry_records (project_id);

alter table public.site_entry_records enable row level security;

drop policy if exists "org members can manage site entry records" on public.site_entry_records;

create policy "org members can manage site entry records"
on public.site_entry_records for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 6. SAFETY RECORDS: ky_activities / near_miss_reports
-- ────────────────────────────────────────────────────────────

create table if not exists public.ky_activities (
  id               text primary key default gen_random_uuid()::text,
  organization_id  uuid references public.organizations(id) on delete cascade,
  date             text not null,
  participants     text[] not null default '{}',
  hazards          text[] not null default '{}',
  countermeasures  text[] not null default '{}',
  created_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.near_miss_reports (
  id               text primary key default gen_random_uuid()::text,
  organization_id  uuid references public.organizations(id) on delete cascade,
  datetime         timestamptz not null,
  location         text not null,
  description      text not null,
  severity         text not null check (severity in ('high', 'medium', 'low')),
  cause_analysis   text not null default '',
  countermeasure   text not null default '',
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ky_activities_org     on public.ky_activities (organization_id);
create index if not exists idx_near_miss_reports_org on public.near_miss_reports (organization_id);

alter table public.ky_activities      enable row level security;
alter table public.near_miss_reports  enable row level security;

drop policy if exists "org members can manage ky activities"     on public.ky_activities;
drop policy if exists "org members can manage near miss reports"  on public.near_miss_reports;

create policy "org members can manage ky activities"
on public.ky_activities for all to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid()
  )
);

create policy "org members can manage near miss reports"
on public.near_miss_reports for all to authenticated
using (
  organization_id in (
    select organization_id from public.organization_members where user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 7. PUNCH LIST: punch_list_items / punch_list_history
-- ────────────────────────────────────────────────────────────

create table if not exists public.punch_list_items (
  id                      text primary key default gen_random_uuid()::text,
  project_id              text not null references public.projects(id) on delete cascade,
  title                   text not null,
  description             text not null default '',
  location                text not null default '',
  trade                   text not null default '',
  priority                text not null default 'medium'
                          check (priority in ('low', 'medium', 'high', 'critical')),
  status                  text not null default 'open'
                          check (status in ('open', 'assigned', 'in_progress', 'resolved', 'verified')),
  created_by              text not null,
  due_date                text,
  assigned_contractor_id  text,
  assigned_contractor_name text,
  resolved_at             timestamptz,
  resolved_by             text,
  resolution_notes        text,
  verified_at             timestamptz,
  verified_by             text,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

create table if not exists public.punch_list_history (
  id           text primary key default gen_random_uuid()::text,
  item_id      text not null references public.punch_list_items(id) on delete cascade,
  action       text not null
               check (action in ('created', 'assigned', 'status_updated', 'resolved', 'verified')),
  status       text not null,
  actor        text not null,
  notes        text,
  created_at   timestamptz not null default timezone('utc', now())
);

create index if not exists idx_punch_list_project on public.punch_list_items (project_id);
create index if not exists idx_punch_list_history_item on public.punch_list_history (item_id);

alter table public.punch_list_items   enable row level security;
alter table public.punch_list_history enable row level security;

drop policy if exists "org members can manage punch list items"   on public.punch_list_items;
drop policy if exists "org members can manage punch list history" on public.punch_list_history;

create policy "org members can manage punch list items"
on public.punch_list_items for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage punch list history"
on public.punch_list_history for all to authenticated
using (
  exists (
    select 1 from public.punch_list_items pli
    join public.projects p on p.id = pli.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where pli.id = item_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 8. EQUIPMENT TRACKER: equipment_rentals / equipment_usage_logs
-- ────────────────────────────────────────────────────────────

create table if not exists public.equipment_rentals (
  id                   text primary key default gen_random_uuid()::text,
  project_id           text not null references public.projects(id) on delete cascade,
  item_name            text not null,
  quantity             integer not null default 1,
  daily_rate           numeric not null default 0,
  rental_start_date    text not null,
  expected_return_date text not null,
  actual_return_date   text,
  vendor               text,
  status               text not null default 'active'
                       check (status in ('active', 'returned', 'overdue')),
  created_at           timestamptz not null default timezone('utc', now()),
  updated_at           timestamptz not null default timezone('utc', now())
);

create table if not exists public.equipment_usage_logs (
  id              text primary key default gen_random_uuid()::text,
  rental_id       text not null references public.equipment_rentals(id) on delete cascade,
  project_id      text not null references public.projects(id) on delete cascade,
  usage_date      text not null,
  hours_used      numeric not null default 0,
  available_hours numeric not null default 8,
  created_at      timestamptz not null default timezone('utc', now())
);

create index if not exists idx_equipment_rentals_project on public.equipment_rentals (project_id);
create index if not exists idx_equipment_usage_rental    on public.equipment_usage_logs (rental_id);

alter table public.equipment_rentals    enable row level security;
alter table public.equipment_usage_logs enable row level security;

drop policy if exists "org members can manage equipment rentals"    on public.equipment_rentals;
drop policy if exists "org members can manage equipment usage logs" on public.equipment_usage_logs;

create policy "org members can manage equipment rentals"
on public.equipment_rentals for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage equipment usage logs"
on public.equipment_usage_logs for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 9. COMPLIANCE TRACKER: compliance_requirements / compliance_audit_log
-- ────────────────────────────────────────────────────────────

create table if not exists public.compliance_requirements (
  id                 text primary key default gen_random_uuid()::text,
  project_id         text not null references public.projects(id) on delete cascade,
  name               text not null,
  category           text not null,
  description        text not null default '',
  due_date           text not null,
  status             text not null default 'compliant'
                     check (status in ('compliant', 'warning', 'overdue', 'not_applicable')),
  completed_date     text,
  responsible_person text,
  document_url       text,
  notes              text,
  created_at         timestamptz not null default timezone('utc', now()),
  updated_at         timestamptz not null default timezone('utc', now())
);

create table if not exists public.compliance_audit_log (
  id               text primary key default gen_random_uuid()::text,
  requirement_id   text not null references public.compliance_requirements(id) on delete cascade,
  action           text not null,
  performed_by     text not null,
  timestamp        timestamptz not null default timezone('utc', now()),
  details          text not null default ''
);

create index if not exists idx_compliance_reqs_project on public.compliance_requirements (project_id);
create index if not exists idx_compliance_audit_req    on public.compliance_audit_log (requirement_id);

alter table public.compliance_requirements enable row level security;
alter table public.compliance_audit_log    enable row level security;

drop policy if exists "org members can manage compliance requirements" on public.compliance_requirements;
drop policy if exists "org members can manage compliance audit log"    on public.compliance_audit_log;

create policy "org members can manage compliance requirements"
on public.compliance_requirements for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage compliance audit log"
on public.compliance_audit_log for all to authenticated
using (
  exists (
    select 1 from public.compliance_requirements cr
    join public.projects p on p.id = cr.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where cr.id = requirement_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 10. CLAIM MANAGER: insurance_claims / claim_documents / claim_disputes
-- ────────────────────────────────────────────────────────────

create table if not exists public.insurance_claims (
  id               text primary key default gen_random_uuid()::text,
  project_id       text not null references public.projects(id) on delete cascade,
  claim_type       text not null,
  incident_date    text not null,
  description      text not null,
  claimed_amount   numeric not null default 0,
  approved_amount  numeric,
  status           text not null default 'open'
                   check (status in ('open', 'under_review', 'approved', 'disputed', 'resolved', 'rejected')),
  opened_by        text not null,
  resolution_date  text,
  notes            text,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.claim_documents (
  id            text primary key default gen_random_uuid()::text,
  claim_id      text not null references public.insurance_claims(id) on delete cascade,
  project_id    text not null references public.projects(id) on delete cascade,
  file_name     text not null,
  document_type text not null
                check (document_type in ('photo', 'invoice', 'report', 'correspondence', 'other')),
  uploaded_at   timestamptz not null default timezone('utc', now()),
  uploaded_by   text not null
);

create table if not exists public.claim_disputes (
  id               text primary key default gen_random_uuid()::text,
  claim_id         text not null references public.insurance_claims(id) on delete cascade,
  project_id       text not null references public.projects(id) on delete cascade,
  reason           text not null,
  disputed_amount  numeric not null default 0,
  opened_date      text not null,
  status           text not null default 'open'
                   check (status in ('open', 'resolved', 'withdrawn')),
  resolution_date  text,
  outcome          text,
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists idx_insurance_claims_project on public.insurance_claims (project_id);
create index if not exists idx_claim_docs_claim         on public.claim_documents (claim_id);
create index if not exists idx_claim_disputes_claim     on public.claim_disputes (claim_id);

alter table public.insurance_claims  enable row level security;
alter table public.claim_documents   enable row level security;
alter table public.claim_disputes    enable row level security;

drop policy if exists "org members can manage insurance claims"  on public.insurance_claims;
drop policy if exists "org members can manage claim documents"   on public.claim_documents;
drop policy if exists "org members can manage claim disputes"    on public.claim_disputes;

create policy "org members can manage insurance claims"
on public.insurance_claims for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage claim documents"
on public.claim_documents for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage claim disputes"
on public.claim_disputes for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 11. PERMIT TRACKER: permit_applications / permit_inspections
-- ────────────────────────────────────────────────────────────

create table if not exists public.permit_applications (
  id               text primary key default gen_random_uuid()::text,
  project_id       text not null references public.projects(id) on delete cascade,
  permit_type      text not null,
  jurisdiction     text not null default '',
  application_date text not null,
  applicant_name   text not null,
  status           text not null default 'applied'
                   check (status in ('applied', 'approved', 'inspection_scheduled', 'expired', 'closed')),
  approval_date    text,
  permit_number    text,
  expiry_date      text,
  notes            text,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.permit_inspections (
  id              text primary key default gen_random_uuid()::text,
  permit_id       text not null references public.permit_applications(id) on delete cascade,
  project_id      text not null references public.projects(id) on delete cascade,
  inspection_type text not null,
  scheduled_date  text not null,
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'passed', 'failed', 'cancelled')),
  inspector_name  text,
  notes           text,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create index if not exists idx_permit_apps_project      on public.permit_applications (project_id);
create index if not exists idx_permit_inspections_permit on public.permit_inspections (permit_id);

alter table public.permit_applications enable row level security;
alter table public.permit_inspections  enable row level security;

drop policy if exists "org members can manage permit applications" on public.permit_applications;
drop policy if exists "org members can manage permit inspections"  on public.permit_inspections;

create policy "org members can manage permit applications"
on public.permit_applications for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage permit inspections"
on public.permit_inspections for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 12. MEETING MINUTES: meeting_minutes / meeting_action_items
-- ────────────────────────────────────────────────────────────

create table if not exists public.meeting_minutes (
  id               text primary key default gen_random_uuid()::text,
  project_id       text not null references public.projects(id) on delete cascade,
  meeting_date     text not null,
  meeting_type     text not null,
  facilitator      text not null,
  location         text,
  attendees        jsonb not null default '[]'::jsonb,
  discussion_points text[] not null default '{}',
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

create table if not exists public.meeting_action_items (
  id          text primary key default gen_random_uuid()::text,
  meeting_id  text not null references public.meeting_minutes(id) on delete cascade,
  description text not null,
  owner       text not null,
  due_date    text,
  status      text not null default 'open'
              check (status in ('open', 'in_progress', 'done')),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meeting_minutes_project      on public.meeting_minutes (project_id);
create index if not exists idx_meeting_action_items_meeting on public.meeting_action_items (meeting_id);

alter table public.meeting_minutes      enable row level security;
alter table public.meeting_action_items enable row level security;

drop policy if exists "org members can manage meeting minutes"      on public.meeting_minutes;
drop policy if exists "org members can manage meeting action items" on public.meeting_action_items;

create policy "org members can manage meeting minutes"
on public.meeting_minutes for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage meeting action items"
on public.meeting_action_items for all to authenticated
using (
  exists (
    select 1 from public.meeting_minutes mm
    join public.projects p on p.id = mm.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where mm.id = meeting_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- 13. WARRANTY TRACKER: warranty_items / warranty_claims
-- ────────────────────────────────────────────────────────────

create table if not exists public.warranty_items (
  id              text primary key default gen_random_uuid()::text,
  project_id      text not null references public.projects(id) on delete cascade,
  asset_name      text not null,
  category        text not null,
  vendor_name     text not null,
  start_date      text not null,
  expiry_date     text not null,
  warranty_terms  text,
  serial_number   text,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create table if not exists public.warranty_claims (
  id               text primary key default gen_random_uuid()::text,
  warranty_item_id text not null references public.warranty_items(id) on delete cascade,
  claim_date       text not null,
  issue            text not null,
  status           text not null default 'submitted'
                   check (status in ('submitted', 'approved', 'denied', 'resolved')),
  resolution_notes text,
  created_at       timestamptz not null default timezone('utc', now()),
  updated_at       timestamptz not null default timezone('utc', now())
);

create index if not exists idx_warranty_items_project on public.warranty_items (project_id);
create index if not exists idx_warranty_claims_item   on public.warranty_claims (warranty_item_id);

alter table public.warranty_items  enable row level security;
alter table public.warranty_claims enable row level security;

drop policy if exists "org members can manage warranty items"  on public.warranty_items;
drop policy if exists "org members can manage warranty claims" on public.warranty_claims;

create policy "org members can manage warranty items"
on public.warranty_items for all to authenticated
using (
  exists (
    select 1 from public.projects p
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = project_id and om.user_id = auth.uid()
  )
);

create policy "org members can manage warranty claims"
on public.warranty_claims for all to authenticated
using (
  exists (
    select 1 from public.warranty_items wi
    join public.projects p on p.id = wi.project_id
    join public.organization_members om on om.organization_id = p.organization_id
    where wi.id = warranty_item_id and om.user_id = auth.uid()
  )
);

-- ────────────────────────────────────────────────────────────
-- RLS 修正: 012 で無効化された projects / tasks を再有効化
-- (022 で phases は有効化済み、ここで projects/tasks を確認)
-- ────────────────────────────────────────────────────────────

alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
