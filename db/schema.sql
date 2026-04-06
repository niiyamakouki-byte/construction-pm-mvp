create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.remove_deleted_task_dependencies()
returns trigger
language plpgsql
as $$
begin
  update public.tasks
  set dependencies = coalesce(
    (
      select jsonb_agg(dependency)
      from jsonb_array_elements(tasks.dependencies) as dependency
      where dependency->>'predecessorId' <> old.id
    ),
    '[]'::jsonb
  ),
  updated_at = timezone('utc', now())
  where project_id = old.project_id
    and id <> old.id
    and dependencies @> jsonb_build_array(jsonb_build_object('predecessorId', old.id));

  return old;
end;
$$;

create table if not exists public.projects (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  name text not null,
  contractor text not null,
  address text not null,
  status text not null check (status in ('planning', 'active', 'completed')),
  description text not null default '',
  start_date date not null,
  end_date date,
  include_weekends boolean not null default true,
  client_id text,
  client_name text,
  contract_amount double precision,
  contract_date date,
  inspection_date date,
  handover_date date,
  warranty_end_date date
);

create table if not exists public.contractors (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  name text not null,
  trade text not null,
  phone text not null,
  email text not null
);

create table if not exists public.tasks (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null check (status in ('todo', 'in_progress', 'done')),
  start_date date,
  due_date date,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  cost double precision not null default 0 check (cost >= 0),
  dependencies jsonb not null default '[]'::jsonb check (jsonb_typeof(dependencies) = 'array'),
  contractor_id text references public.contractors(id) on delete set null,
  contractor text,
  is_milestone boolean not null default false
);

create table if not exists public.materials (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  quantity double precision not null check (quantity >= 0),
  unit text not null,
  unit_price double precision not null check (unit_price >= 0),
  supplier text not null,
  delivery_date date not null,
  status text not null check (status in ('ordered', 'delivered', 'installed'))
);

create table if not exists public.change_orders (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  project_id text not null references public.projects(id) on delete cascade,
  description text not null,
  amount double precision not null,
  approved_by text not null,
  date date not null,
  status text not null check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.notifications (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  type text not null,
  message text not null,
  project_id text not null references public.projects(id) on delete cascade,
  recipient_id text not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  read boolean not null default false,
  read_at timestamptz
);

create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_created_at_idx on public.projects (created_at desc);

create index if not exists contractors_trade_idx on public.contractors (trade);
create index if not exists contractors_created_at_idx on public.contractors (created_at desc);

create index if not exists tasks_project_id_idx on public.tasks (project_id);
create index if not exists tasks_contractor_id_idx on public.tasks (contractor_id);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_dependencies_gin_idx on public.tasks using gin (dependencies);

create index if not exists materials_project_id_idx on public.materials (project_id);
create index if not exists materials_status_idx on public.materials (status);
create index if not exists materials_delivery_date_idx on public.materials (delivery_date);

create index if not exists change_orders_project_id_idx on public.change_orders (project_id);
create index if not exists change_orders_status_idx on public.change_orders (status);
create index if not exists change_orders_date_idx on public.change_orders (date desc);

create index if not exists notifications_project_id_idx on public.notifications (project_id);
create index if not exists notifications_read_idx on public.notifications (read);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists set_contractors_updated_at on public.contractors;
create trigger set_contractors_updated_at
before update on public.contractors
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_materials_updated_at on public.materials;
create trigger set_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists set_change_orders_updated_at on public.change_orders;
create trigger set_change_orders_updated_at
before update on public.change_orders
for each row execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists remove_deleted_task_dependencies_trigger on public.tasks;
create trigger remove_deleted_task_dependencies_trigger
after delete on public.tasks
for each row execute function public.remove_deleted_task_dependencies();

alter table public.projects enable row level security;
alter table public.contractors enable row level security;
alter table public.tasks enable row level security;
alter table public.materials enable row level security;
alter table public.change_orders enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "anon full access projects" on public.projects;
create policy "anon full access projects"
on public.projects
for all
to anon
using (true)
with check (true);

drop policy if exists "authenticated full access projects" on public.projects;
create policy "authenticated full access projects"
on public.projects
for all
to authenticated
using (true)
with check (true);

drop policy if exists "anon full access contractors" on public.contractors;
create policy "anon full access contractors"
on public.contractors
for all
to anon
using (true)
with check (true);

drop policy if exists "authenticated full access contractors" on public.contractors;
create policy "authenticated full access contractors"
on public.contractors
for all
to authenticated
using (true)
with check (true);

drop policy if exists "anon full access tasks" on public.tasks;
create policy "anon full access tasks"
on public.tasks
for all
to anon
using (true)
with check (true);

drop policy if exists "authenticated full access tasks" on public.tasks;
create policy "authenticated full access tasks"
on public.tasks
for all
to authenticated
using (true)
with check (true);

drop policy if exists "anon full access materials" on public.materials;
create policy "anon full access materials"
on public.materials
for all
to anon
using (true)
with check (true);

drop policy if exists "authenticated full access materials" on public.materials;
create policy "authenticated full access materials"
on public.materials
for all
to authenticated
using (true)
with check (true);

drop policy if exists "anon full access change_orders" on public.change_orders;
create policy "anon full access change_orders"
on public.change_orders
for all
to anon
using (true)
with check (true);

drop policy if exists "authenticated full access change_orders" on public.change_orders;
create policy "authenticated full access change_orders"
on public.change_orders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "anon full access notifications" on public.notifications;
create policy "anon full access notifications"
on public.notifications
for all
to anon
using (true)
with check (true);

drop policy if exists "authenticated full access notifications" on public.notifications;
create policy "authenticated full access notifications"
on public.notifications
for all
to authenticated
using (true)
with check (true);
