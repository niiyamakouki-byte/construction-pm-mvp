create table if not exists public.projects (
  id text primary key,
  name text not null,
  description text not null default '',
  status text not null check (status in ('planning', 'active', 'completed', 'on_hold')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.tasks (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null check (status in ('todo', 'in_progress', 'done')),
  assignee_id text,
  due_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.resources (
  id text primary key,
  name text not null,
  type text not null check (type in ('worker', 'equipment', 'material')),
  unit text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cost_items (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  task_id text references public.tasks(id) on delete set null,
  description text not null,
  amount numeric(12, 2) not null,
  category text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_resources_updated_at on public.resources;
create trigger set_resources_updated_at
before update on public.resources
for each row
execute function public.set_updated_at();

drop trigger if exists set_cost_items_updated_at on public.cost_items;
create trigger set_cost_items_updated_at
before update on public.cost_items
for each row
execute function public.set_updated_at();

create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_created_at_idx on public.projects (created_at desc);
create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists resources_type_idx on public.resources (type);
create index if not exists cost_items_project_id_idx on public.cost_items (project_id);
create index if not exists cost_items_task_id_idx on public.cost_items (task_id);
create index if not exists cost_items_category_idx on public.cost_items (category);

alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.resources enable row level security;
alter table public.cost_items enable row level security;

drop policy if exists "authenticated can manage projects" on public.projects;
create policy "authenticated can manage projects"
on public.projects
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can manage tasks" on public.tasks;
create policy "authenticated can manage tasks"
on public.tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can manage resources" on public.resources;
create policy "authenticated can manage resources"
on public.resources
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated can manage cost items" on public.cost_items;
create policy "authenticated can manage cost items"
on public.cost_items
for all
to authenticated
using (true)
with check (true);
