-- ============================================================
-- Organizations & multi-tenancy foundation
-- ============================================================

-- ── organizations ────────────────────────────────────────────
create table if not exists public.organizations (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  plan                   text not null default 'trial',
  stripe_customer_id     text,
  stripe_subscription_id text,
  plan_period_end        timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ── organization_members ─────────────────────────────────────
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  organization_id uuid not null references public.organizations on delete cascade,
  role            text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  unique (user_id, organization_id)
);

-- ── updated_at trigger ───────────────────────────────────────
drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- ── indexes ──────────────────────────────────────────────────
create index if not exists org_members_user_id_idx on public.organization_members (user_id);
create index if not exists org_members_org_id_idx  on public.organization_members (organization_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;

-- Organizations: members can read their own org
drop policy if exists "members can read own organization" on public.organizations;
create policy "members can read own organization"
on public.organizations for select to authenticated
using (
  id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid()
  )
);

-- Organizations: owners/admins can update
drop policy if exists "owners can update organization" on public.organizations;
create policy "owners can update organization"
on public.organizations for update to authenticated
using (
  id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid() and om.role in ('owner', 'admin')
  )
)
with check (
  id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid() and om.role in ('owner', 'admin')
  )
);

-- Organizations: anyone authenticated can insert (for auto-create on signup)
drop policy if exists "authenticated can create organization" on public.organizations;
create policy "authenticated can create organization"
on public.organizations for insert to authenticated
with check (true);

-- Organization members: members can read own memberships
drop policy if exists "members can read own memberships" on public.organization_members;
create policy "members can read own memberships"
on public.organization_members for select to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid()
  )
);

-- Organization members: authenticated can insert (for auto-create on signup)
drop policy if exists "authenticated can insert membership" on public.organization_members;
create policy "authenticated can insert membership"
on public.organization_members for insert to authenticated
with check (true);

-- Organization members: owners/admins can manage members
drop policy if exists "owners can manage memberships" on public.organization_members;
create policy "owners can manage memberships"
on public.organization_members for delete to authenticated
using (
  organization_id in (
    select om.organization_id from public.organization_members om
    where om.user_id = auth.uid() and om.role in ('owner', 'admin')
  )
);
