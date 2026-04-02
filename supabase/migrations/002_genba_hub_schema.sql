-- ============================================================
-- GenbaHub 拡張スキーマ
-- 追加テーブル: projects拡張, tasks拡張, daily_reports,
--              estimates, expenses, team_members
-- ============================================================

-- ── team_members ────────────────────────────────────────────
create table if not exists public.team_members (
  id          text primary key,
  name        text not null,
  role        text not null default '',
  email       text,
  phone       text,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

-- ── projects 拡張カラム ──────────────────────────────────────
alter table public.projects
  add column if not exists address  text,
  add column if not exists budget   numeric(14, 2);

-- latitude / longitude は既存コードで扱われているが
-- 001 スキーマに未追加なので追加
alter table public.projects
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

-- ── tasks 拡張カラム ─────────────────────────────────────────
-- start_date / progress / dependencies を追加
alter table public.tasks
  add column if not exists start_date    date,
  add column if not exists progress      integer not null default 0
    check (progress >= 0 and progress <= 100),
  add column if not exists dependencies  text[] not null default '{}';

-- ── daily_reports ────────────────────────────────────────────
create table if not exists public.daily_reports (
  id          text primary key,
  project_id  text not null references public.projects(id) on delete cascade,
  report_date date not null,
  weather     text,
  content     text not null default '',
  photo_urls  text[] not null default '{}',
  author_id   text references public.team_members(id) on delete set null,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

-- ── estimates ────────────────────────────────────────────────
create table if not exists public.estimates (
  id          text primary key,
  project_id  text not null references public.projects(id) on delete cascade,
  item_name   text not null,
  quantity    numeric(12, 3) not null default 0,
  unit        text not null default '',
  unit_price  numeric(12, 2) not null default 0,
  amount      numeric(14, 2) generated always as (quantity * unit_price) stored,
  category    text not null default '',
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

-- ── expenses ─────────────────────────────────────────────────
create table if not exists public.expenses (
  id                text primary key,
  project_id        text not null references public.projects(id) on delete cascade,
  expense_date      date not null,
  description       text not null,
  amount            numeric(12, 2) not null,
  category          text not null default '',
  receipt_url       text,
  approval_status   text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now())
);

-- ── updated_at トリガー ──────────────────────────────────────
-- set_updated_at 関数は 001 で定義済み

drop trigger if exists set_team_members_updated_at on public.team_members;
create trigger set_team_members_updated_at
before update on public.team_members
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_reports_updated_at on public.daily_reports;
create trigger set_daily_reports_updated_at
before update on public.daily_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_estimates_updated_at on public.estimates;
create trigger set_estimates_updated_at
before update on public.estimates
for each row execute function public.set_updated_at();

drop trigger if exists set_expenses_updated_at on public.expenses;
create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- ── インデックス ─────────────────────────────────────────────
create index if not exists team_members_name_idx        on public.team_members (name);

create index if not exists daily_reports_project_id_idx on public.daily_reports (project_id);
create index if not exists daily_reports_date_idx       on public.daily_reports (report_date desc);

create index if not exists estimates_project_id_idx     on public.estimates (project_id);
create index if not exists estimates_category_idx       on public.estimates (category);

create index if not exists expenses_project_id_idx      on public.expenses (project_id);
create index if not exists expenses_date_idx            on public.expenses (expense_date desc);
create index if not exists expenses_status_idx          on public.expenses (approval_status);
create index if not exists expenses_category_idx        on public.expenses (category);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.team_members   enable row level security;
alter table public.daily_reports  enable row level security;
alter table public.estimates      enable row level security;
alter table public.expenses       enable row level security;

drop policy if exists "authenticated can manage team members" on public.team_members;
create policy "authenticated can manage team members"
on public.team_members for all to authenticated
using (true) with check (true);

drop policy if exists "anon can read team members" on public.team_members;
create policy "anon can read team members"
on public.team_members for select to anon
using (true);

drop policy if exists "authenticated can manage daily reports" on public.daily_reports;
create policy "authenticated can manage daily reports"
on public.daily_reports for all to authenticated
using (true) with check (true);

drop policy if exists "authenticated can manage estimates" on public.estimates;
create policy "authenticated can manage estimates"
on public.estimates for all to authenticated
using (true) with check (true);

drop policy if exists "authenticated can manage expenses" on public.expenses;
create policy "authenticated can manage expenses"
on public.expenses for all to authenticated
using (true) with check (true);

-- anon READ ポリシー（MVP段階：認証なしでも閲覧可）
drop policy if exists "anon can read projects" on public.projects;
create policy "anon can read projects"
on public.projects for select to anon
using (true);

drop policy if exists "anon can read tasks" on public.tasks;
create policy "anon can read tasks"
on public.tasks for select to anon
using (true);

drop policy if exists "anon can read daily reports" on public.daily_reports;
create policy "anon can read daily reports"
on public.daily_reports for select to anon
using (true);

drop policy if exists "anon can read estimates" on public.estimates;
create policy "anon can read estimates"
on public.estimates for select to anon
using (true);

drop policy if exists "anon can read expenses" on public.expenses;
create policy "anon can read expenses"
on public.expenses for select to anon
using (true);
