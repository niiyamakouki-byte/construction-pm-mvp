-- ============================================================
-- 025: phase_cascade_constraints
-- Phase 2.0: 玉突き遅延エンジン対応
--   1. validate_phase_status_transition トリガー (DB レベルガード)
--   2. phase_status_history に cascade_origin_phase_id 列追加
-- ============================================================

-- ── 1. ステータス遷移バリデーション関数 ──────────────────────
create or replace function public.validate_phase_status_transition()
returns trigger
language plpgsql
security definer
as $$
begin
  -- ステータスが変わっていなければ何もしない
  if OLD.status is not distinct from NEW.status then
    return NEW;
  end if;

  -- 許可されている遷移テーブル
  -- planned      -> in_progress, canceled
  -- in_progress  -> blocked, done, canceled
  -- blocked      -> in_progress, canceled
  -- done         -> (terminal)
  -- canceled     -> (terminal)
  if (OLD.status = 'planned'     and NEW.status in ('in_progress', 'canceled')) or
     (OLD.status = 'in_progress' and NEW.status in ('blocked', 'done', 'canceled')) or
     (OLD.status = 'blocked'     and NEW.status in ('in_progress', 'canceled'))
  then
    return NEW;
  end if;

  raise exception 'invalid phase status transition: % -> %', OLD.status, NEW.status;
end;
$$;

-- トリガーを phases テーブルに付与
drop trigger if exists trg_validate_phase_status_transition on public.phases;
create trigger trg_validate_phase_status_transition
before update on public.phases
for each row execute function public.validate_phase_status_transition();

-- ── 2. phase_status_history に cascade_origin_phase_id を追加 ─
-- 玉突きの起点フェーズを記録する列 (nullable)
alter table public.phase_status_history
  add column if not exists cascade_origin_phase_id text
    references public.phases(id) on delete set null;

create index if not exists idx_phase_status_history_cascade_origin
  on public.phase_status_history (cascade_origin_phase_id)
  where cascade_origin_phase_id is not null;
