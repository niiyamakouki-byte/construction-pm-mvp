-- ============================================================
-- 024: phase_status ENUM + phase_status_history テーブル + trigger
-- Phase 1.6: 工程ステータス遷移 + 監査履歴
-- ============================================================

-- ── phase_status ENUM ────────────────────────────────────────
-- 新 ENUM: 'blocked' / 'canceled' を追加。旧 'skipped' は廃止済み (022 の check 制約のみ)
create type public.phase_status as enum (
  'planned',
  'in_progress',
  'blocked',
  'done',
  'canceled'
);

-- ── phases.status を ENUM 型に置き換え ───────────────────────
-- 1) 旧 check 制約を削除
alter table public.phases
  drop constraint if exists phases_status_check;

-- 2) text → phase_status へ ALTER (USING で既存値を変換)
--    旧値 'skipped' は 'canceled' へ移行
alter table public.phases
  alter column status drop default;

alter table public.phases
  alter column status type public.phase_status
  using (
    case status
      when 'skipped' then 'canceled'::public.phase_status
      else status::public.phase_status
    end
  );

alter table public.phases
  alter column status set default 'planned'::public.phase_status;

-- ── phase_status_history テーブル ────────────────────────────
create table if not exists public.phase_status_history (
  id          uuid primary key default gen_random_uuid(),
  phase_id    text not null references public.phases(id) on delete cascade,
  old_status  public.phase_status,
  new_status  public.phase_status not null,
  changed_at  timestamptz not null default timezone('utc', now()),
  changed_by  uuid references auth.users(id) on delete set null
);

create index if not exists idx_phase_status_history_phase_id
  on public.phase_status_history (phase_id);

create index if not exists idx_phase_status_history_changed_at
  on public.phase_status_history (changed_at desc);

-- ── RLS for phase_status_history ─────────────────────────────
alter table public.phase_status_history enable row level security;

drop policy if exists "authenticated can access own phase status history" on public.phase_status_history;
create policy "authenticated can access own phase status history"
on public.phase_status_history for all to authenticated
using (
  exists (
    select 1
    from public.phases ph
    join public.projects p on p.id = ph.project_id
    where ph.id = phase_id
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

-- ── trigger: status 変更時に履歴 insert ──────────────────────
create or replace function public.record_phase_status_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status is distinct from NEW.status then
    insert into public.phase_status_history (phase_id, old_status, new_status, changed_by)
    values (NEW.id, OLD.status, NEW.status, auth.uid());
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_phase_status_history on public.phases;
create trigger trg_phase_status_history
after update on public.phases
for each row execute function public.record_phase_status_change();
