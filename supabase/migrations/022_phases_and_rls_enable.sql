-- ============================================================
-- 022: phases テーブル追加 + projects/tasks/project_tasks RLS 有効化
-- Phase 1: 工程データの CRUD 永続化
-- ============================================================

-- ── phases テーブル ────────────────────────────────────────────
-- 13大項目・103エントリの3階層工程マスターに対応。
-- level: 1=大項目, 2=中項目, 3=小項目
create table if not exists public.phases (
  id              text primary key default gen_random_uuid()::text,
  project_id      text not null references public.projects(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  parent_id       text references public.phases(id) on delete cascade,
  level           integer not null check (level in (1, 2, 3)),
  name            text not null,
  order_index     integer not null default 0,
  start_date      date,
  end_date        date,
  status          text not null default 'planned'
    check (status in ('planned', 'in_progress', 'done', 'skipped')),
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

create index if not exists idx_phases_project_id on public.phases (project_id);
create index if not exists idx_phases_parent_id  on public.phases (parent_id);
create index if not exists idx_phases_org_id     on public.phases (organization_id);

drop trigger if exists set_phases_updated_at on public.phases;
create trigger set_phases_updated_at
before update on public.phases
for each row execute function public.set_updated_at();

-- ── phases RLS ────────────────────────────────────────────────
alter table public.phases enable row level security;

drop policy if exists "authenticated can access own project phases" on public.phases;
create policy "authenticated can access own project phases"
on public.phases for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        p.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = auth.uid()
        )
        or p.organization_id is null
      )
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        p.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = auth.uid()
        )
        or p.organization_id is null
      )
  )
);

-- ── tasks テーブルへの project_id FK インデックス ─────────────
-- tasks.project_id はすでに存在するが index がない場合に追加
create index if not exists idx_tasks_project_id on public.tasks (project_id);

-- ── projects RLS 再有効化 ─────────────────────────────────────
-- migration 012 で DISABLE された RLS を再有効化する
alter table public.projects enable row level security;
alter table public.tasks     enable row level security;

-- projects: authenticated ユーザーが自分の組織 or 組織なしプロジェクトを操作
drop policy if exists "authenticated can access own projects" on public.projects;
create policy "authenticated can access own projects"
on public.projects for all to authenticated
using (
  organization_id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
  )
  or organization_id is null
)
with check (
  organization_id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
  )
  or organization_id is null
);

-- tasks: project_id 経由でアクセス制御
drop policy if exists "authenticated can access own tasks" on public.tasks;
create policy "authenticated can access own tasks"
on public.tasks for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        p.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = auth.uid()
        )
        or p.organization_id is null
      )
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        p.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = auth.uid()
        )
        or p.organization_id is null
      )
  )
);
