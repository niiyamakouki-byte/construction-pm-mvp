-- ============================================================
-- Add organization_id to all data tables + rewrite RLS
-- ============================================================

-- ── Add organization_id columns ──────────────────────────────
alter table public.projects      add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.tasks         add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.resources     add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.cost_items    add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.team_members  add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.daily_reports add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.estimates     add column if not exists organization_id uuid references public.organizations on delete cascade;
alter table public.expenses      add column if not exists organization_id uuid references public.organizations on delete cascade;

-- ── indexes ──────────────────────────────────────────────────
create index if not exists projects_org_id_idx      on public.projects      (organization_id);
create index if not exists tasks_org_id_idx         on public.tasks         (organization_id);
create index if not exists resources_org_id_idx     on public.resources     (organization_id);
create index if not exists cost_items_org_id_idx    on public.cost_items    (organization_id);
create index if not exists team_members_org_id_idx  on public.team_members  (organization_id);
create index if not exists daily_reports_org_id_idx on public.daily_reports (organization_id);
create index if not exists estimates_org_id_idx     on public.estimates     (organization_id);
create index if not exists expenses_org_id_idx      on public.expenses      (organization_id);

-- ── Helper: org membership subquery ──────────────────────────
-- used inline in each policy below

-- ── projects RLS ─────────────────────────────────────────────
drop policy if exists "authenticated can manage projects" on public.projects;
drop policy if exists "anon can read projects" on public.projects;

create policy "org members can manage projects"
on public.projects for all to authenticated
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

-- ── tasks RLS ────────────────────────────────────────────────
drop policy if exists "authenticated can manage tasks" on public.tasks;
drop policy if exists "anon can read tasks" on public.tasks;

create policy "org members can manage tasks"
on public.tasks for all to authenticated
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

-- ── resources RLS ────────────────────────────────────────────
drop policy if exists "authenticated can manage resources" on public.resources;

create policy "org members can manage resources"
on public.resources for all to authenticated
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

-- ── cost_items RLS ───────────────────────────────────────────
drop policy if exists "authenticated can manage cost items" on public.cost_items;

create policy "org members can manage cost items"
on public.cost_items for all to authenticated
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

-- ── team_members RLS ─────────────────────────────────────────
drop policy if exists "authenticated can manage team members" on public.team_members;
drop policy if exists "anon can read team members" on public.team_members;

create policy "org members can manage team members"
on public.team_members for all to authenticated
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

-- ── daily_reports RLS ────────────────────────────────────────
drop policy if exists "authenticated can manage daily reports" on public.daily_reports;
drop policy if exists "anon can read daily reports" on public.daily_reports;

create policy "org members can manage daily reports"
on public.daily_reports for all to authenticated
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

-- ── estimates RLS ────────────────────────────────────────────
drop policy if exists "authenticated can manage estimates" on public.estimates;
drop policy if exists "anon can read estimates" on public.estimates;

create policy "org members can manage estimates"
on public.estimates for all to authenticated
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

-- ── expenses RLS ─────────────────────────────────────────────
drop policy if exists "authenticated can manage expenses" on public.expenses;
drop policy if exists "anon can read expenses" on public.expenses;

create policy "org members can manage expenses"
on public.expenses for all to authenticated
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
