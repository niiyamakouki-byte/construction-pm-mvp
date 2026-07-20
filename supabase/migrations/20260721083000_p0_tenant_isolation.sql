-- Ticket: P0-TENANT-20260721
-- Provenance: base commit dddf1c5; author type Codex agent; created 2026-07-21 JST.
-- Purpose: finish the pre-signup tenant-isolation work announced in
-- draft_2026_05_13_rls_phase1.sql. Apply only after a verified production backup.

begin;

do $$
begin
  if not exists (
    select 1
    from public.organizations
    where id = '795fb114-c382-41f0-9935-652ca66b9db0'::uuid
  ) then
    raise exception 'P0 tenant migration aborted: primary organization is missing';
  end if;
end
$$;

-- The five project-domain tables below were created without tenant columns.
alter table public.contractors
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.documents
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.document_versions
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.notifications
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.project_tasks
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

-- All pre-multitenancy customer data belongs to La Porta's primary organization.
update public.projects
set organization_id = '795fb114-c382-41f0-9935-652ca66b9db0'::uuid
where organization_id is null;

-- Project-owned rows inherit the canonical organization from their project.
do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'change_requests', 'chat_messages', 'claim_disputes', 'claim_documents',
    'compliance_requirements', 'contract_checklists', 'cost_items',
    'crew_assignments', 'customers', 'daily_reports', 'deals',
    'document_versions', 'documents', 'drawing_pins', 'equipment_rentals',
    'equipment_usage_logs', 'estimates', 'execution_budgets', 'expenses',
    'insurance_claims', 'invoices', 'ky_activities', 'labor_time_entries',
    'meeting_minutes', 'mood_boards', 'near_miss_reports', 'notifications',
    'permit_applications', 'permit_inspections', 'phases', 'photos',
    'procurement_materials', 'project_payment_plans', 'project_tasks',
    'punch_list_items', 'purchase_orders', 'safety_documents',
    'selection_items', 'site_entry_records', 'tasks', 'warranty_items'
  ]
  loop
    execute format(
      'update public.%I child set organization_id = project.organization_id '
      'from public.projects project where child.project_id = project.id '
      'and child.organization_id is distinct from project.organization_id',
      tenant_table
    );
  end loop;
end
$$;

-- Remaining legacy rows are organization-owned rather than project-owned.
do $$
declare
  tenant_table text;
begin
  foreach tenant_table in array array[
    'change_requests', 'chat_messages', 'claim_disputes', 'claim_documents',
    'compliance_audit_log', 'compliance_requirements', 'contract_checklists',
    'contractors', 'cost_items', 'crew_assignments', 'customers',
    'daily_reports', 'deals', 'document_versions', 'documents', 'drawing_pins',
    'equipment_rentals', 'equipment_usage_logs', 'estimates',
    'execution_budgets', 'expenses', 'insurance_claims', 'invoices',
    'ky_activities', 'labor_time_entries', 'meeting_action_items',
    'meeting_minutes', 'mood_boards', 'near_miss_reports', 'notifications',
    'permit_applications', 'permit_inspections', 'phase_status_history',
    'phases', 'photos', 'procurement_materials', 'project_payment_plans',
    'project_tasks', 'projects', 'punch_list_history', 'punch_list_items',
    'purchase_orders', 'resources', 'safety_documents', 'selection_items',
    'site_entry_records', 'tasks', 'team_members', 'warranty_claims',
    'warranty_items'
  ]
  loop
    execute format(
      'update public.%I set organization_id = %L::uuid where organization_id is null',
      tenant_table,
      '795fb114-c382-41f0-9935-652ca66b9db0'
    );
  end loop;
end
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = p_organization_id
      and member.user_id = auth.uid()
  )
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;

-- Project/storage access must never treat an unassigned project as public.
create or replace function public.is_project_org_member(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects project
    where project.id::text = p_project_id
      and project.organization_id is not null
      and public.is_org_member(project.organization_id)
  )
$$;

revoke all on function public.is_project_org_member(text) from public;
grant execute on function public.is_project_org_member(text) to authenticated, service_role;

-- Fill omitted organization_id values and reject cross-tenant project references.
create or replace function public.enforce_tenant_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_id_value text;
  project_organization_id uuid;
  member_organization_id uuid;
  membership_count integer;
begin
  if to_jsonb(new) ? 'project_id' then
    project_id_value := nullif(to_jsonb(new) ->> 'project_id', '');
  end if;

  if project_id_value is not null then
    select project.organization_id
    into project_organization_id
    from public.projects project
    where project.id::text = project_id_value;

    if not found or project_organization_id is null then
      raise exception using
        errcode = '23503',
        message = format('project %s has no tenant organization', project_id_value);
    end if;

    if new.organization_id is null then
      new.organization_id := project_organization_id;
    elsif new.organization_id <> project_organization_id then
      raise exception using
        errcode = '23514',
        message = 'organization_id does not match the referenced project';
    end if;
  end if;

  if new.organization_id is null and auth.uid() is not null then
    select (array_agg(member.organization_id order by member.organization_id))[1], count(*)
    into member_organization_id, membership_count
    from public.organization_members member
    where member.user_id = auth.uid();

    if membership_count = 1 then
      new.organization_id := member_organization_id;
    else
      raise exception using
        errcode = '23514',
        message = 'exactly one organization membership is required when organization_id is omitted';
    end if;
  end if;

  if new.organization_id is null then
    raise exception using errcode = '23502', message = 'organization_id is required';
  end if;

  if auth.uid() is not null and not public.is_org_member(new.organization_id) then
    raise exception using errcode = '42501', message = 'organization membership is required';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_tenant_organization() from public;
grant execute on function public.enforce_tenant_organization() to authenticated, service_role;

-- Replace every permissive customer-data policy with one membership policy,
-- require an org on every customer-data row, and enforce writes at the DB edge.
do $$
declare
  tenant_table text;
  existing_policy record;
begin
  foreach tenant_table in array array[
    'change_requests', 'chat_messages', 'claim_disputes', 'claim_documents',
    'compliance_audit_log', 'compliance_requirements', 'contract_checklists',
    'contractors', 'cost_items', 'crew_assignments', 'customers',
    'daily_reports', 'deals', 'document_versions', 'documents', 'drawing_pins',
    'equipment_rentals', 'equipment_usage_logs', 'estimates',
    'execution_budgets', 'expenses', 'insurance_claims', 'invoices',
    'ky_activities', 'labor_time_entries', 'meeting_action_items',
    'meeting_minutes', 'mood_boards', 'near_miss_reports', 'notifications',
    'permit_applications', 'permit_inspections', 'phase_status_history',
    'phases', 'photos', 'procurement_materials', 'project_payment_plans',
    'project_tasks', 'projects', 'punch_list_history', 'punch_list_items',
    'purchase_orders', 'resources', 'safety_documents', 'selection_items',
    'site_entry_records', 'tasks', 'team_members', 'warranty_claims',
    'warranty_items'
  ]
  loop
    execute format('alter table public.%I alter column organization_id set not null', tenant_table);
    execute format('create index if not exists %I on public.%I (organization_id)', tenant_table || '_organization_id_idx', tenant_table);
    execute format('alter table public.%I enable row level security', tenant_table);

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = tenant_table
    loop
      execute format('drop policy %I on public.%I', existing_policy.policyname, tenant_table);
    end loop;

    execute format(
      'create policy tenant_members_all on public.%I for all to authenticated '
      'using (public.is_org_member(organization_id)) '
      'with check (public.is_org_member(organization_id))',
      tenant_table
    );

    execute format('drop trigger if exists enforce_tenant_organization on public.%I', tenant_table);
    execute format(
      'create trigger enforce_tenant_organization before insert or update on public.%I '
      'for each row execute function public.enforce_tenant_organization()',
      tenant_table
    );
  end loop;
end
$$;

-- New users may create only their own organization membership.
create or replace function public.ensure_user_organization(
  p_user_id uuid,
  p_org_name text default 'My Organization'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization_id_value uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception using errcode = '42501', message = 'users may create only their own organization';
  end if;

  select member.organization_id
  into organization_id_value
  from public.organization_members member
  where member.user_id = p_user_id
  order by member.created_at, member.organization_id
  limit 1;

  if organization_id_value is not null then
    return organization_id_value;
  end if;

  insert into public.organizations (name, plan)
  values (coalesce(nullif(btrim(p_org_name), ''), 'My Organization'), 'trial')
  returning id into organization_id_value;

  insert into public.organization_members (user_id, organization_id, role)
  values (p_user_id, organization_id_value, 'owner');

  return organization_id_value;
end
$$;

revoke all on function public.ensure_user_organization(uuid, text) from public, anon;
grant execute on function public.ensure_user_organization(uuid, text) to authenticated;

-- Migration-time invariants. Any failure rolls the whole transaction back.
do $$
declare
  tenant_table text;
  null_count bigint;
begin
  foreach tenant_table in array array[
    'change_requests', 'chat_messages', 'claim_disputes', 'claim_documents',
    'compliance_audit_log', 'compliance_requirements', 'contract_checklists',
    'contractors', 'cost_items', 'crew_assignments', 'customers',
    'daily_reports', 'deals', 'document_versions', 'documents', 'drawing_pins',
    'equipment_rentals', 'equipment_usage_logs', 'estimates',
    'execution_budgets', 'expenses', 'insurance_claims', 'invoices',
    'ky_activities', 'labor_time_entries', 'meeting_action_items',
    'meeting_minutes', 'mood_boards', 'near_miss_reports', 'notifications',
    'permit_applications', 'permit_inspections', 'phase_status_history',
    'phases', 'photos', 'procurement_materials', 'project_payment_plans',
    'project_tasks', 'projects', 'punch_list_history', 'punch_list_items',
    'purchase_orders', 'resources', 'safety_documents', 'selection_items',
    'site_entry_records', 'tasks', 'team_members', 'warranty_claims',
    'warranty_items'
  ]
  loop
    execute format('select count(*) from public.%I where organization_id is null', tenant_table)
    into null_count;
    if null_count <> 0 then
      raise exception 'P0 tenant migration aborted: %.organization_id still has % NULL rows', tenant_table, null_count;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and (qual = 'true' or with_check = 'true' or policyname = 'authenticated_full_access')
      and tablename = any (array[
        'projects', 'tasks', 'documents', 'document_versions', 'photos',
        'estimates', 'invoices', 'customers', 'contractors'
      ])
  ) then
    raise exception 'P0 tenant migration aborted: permissive customer policy remains';
  end if;
end
$$;

commit;
