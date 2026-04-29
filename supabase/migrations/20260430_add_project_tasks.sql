create table if not exists public.project_tasks (
  id text primary key default gen_random_uuid()::text,
  project_id text not null references public.projects(id) on delete cascade,
  estimate_line_id text,
  category text not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  duration_days integer not null check (duration_days > 0),
  depends_on text[] not null default '{}',
  assignee_id text references public.team_members(id) on delete set null,
  status text not null default 'planned'
    check (status in ('planned', 'todo', 'in_progress', 'done')),
  order_index integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_project_tasks_project on public.project_tasks (project_id);
create index if not exists idx_project_tasks_status on public.project_tasks (status);

alter table public.project_tasks enable row level security;

drop trigger if exists set_project_tasks_updated_at on public.project_tasks;
create trigger set_project_tasks_updated_at
before update on public.project_tasks
for each row execute function public.set_updated_at();

drop policy if exists "org members can manage project tasks" on public.project_tasks;
create policy "org members can manage project tasks"
on public.project_tasks for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.organization_id in (
        select om.organization_id
        from public.organization_members om
        where om.user_id = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.organization_id in (
        select om.organization_id
        from public.organization_members om
        where om.user_id = auth.uid()
      )
  )
);
