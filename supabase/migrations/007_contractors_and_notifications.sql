-- ============================================================
-- 007: contractors, notifications, include_weekends
-- ============================================================

-- ── projects: 土日設定カラム ─────────────────────────────────
alter table public.projects
  add column if not exists include_weekends boolean not null default true;

-- ── contractors ──────────────────────────────────────────────
create table if not exists public.contractors (
  id             text primary key,
  name           text not null,
  contact_person text,
  phone          text,
  email          text,
  line_id        text,
  specialty      text,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

-- ── tasks: contractor_id カラム ──────────────────────────────
alter table public.tasks
  add column if not exists contractor_id text references public.contractors(id) on delete set null;

-- ── notifications ────────────────────────────────────────────
create table if not exists public.notifications (
  id            text primary key,
  project_id    text references public.projects(id) on delete cascade,
  task_id       text references public.tasks(id) on delete cascade,
  contractor_id text references public.contractors(id) on delete set null,
  type          text not null
    check (type in ('schedule_confirmed', 'schedule_changed', 'reminder', 'alert')),
  message       text not null default '',
  status        text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

-- ── updated_at トリガー ──────────────────────────────────────
drop trigger if exists set_contractors_updated_at on public.contractors;
create trigger set_contractors_updated_at
before update on public.contractors
for each row execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

-- ── インデックス ─────────────────────────────────────────────
create index if not exists contractors_name_idx           on public.contractors (name);
create index if not exists notifications_project_id_idx   on public.notifications (project_id);
create index if not exists notifications_task_id_idx      on public.notifications (task_id);
create index if not exists notifications_contractor_id_idx on public.notifications (contractor_id);
create index if not exists notifications_status_idx       on public.notifications (status);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.contractors   enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "authenticated can manage contractors" on public.contractors;
create policy "authenticated can manage contractors"
on public.contractors for all to authenticated
using (true) with check (true);

drop policy if exists "anon can read contractors" on public.contractors;
create policy "anon can read contractors"
on public.contractors for select to anon
using (true);

drop policy if exists "authenticated can manage notifications" on public.notifications;
create policy "authenticated can manage notifications"
on public.notifications for all to authenticated
using (true) with check (true);

drop policy if exists "anon can read notifications" on public.notifications;
create policy "anon can read notifications"
on public.notifications for select to anon
using (true);
