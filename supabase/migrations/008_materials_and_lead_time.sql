-- ============================================================
-- 008: materials and lead_time_days on tasks
-- ============================================================

-- ── tasks: 材料管理カラム ─────────────────────────────────────
alter table public.tasks
  add column if not exists materials    text[],
  add column if not exists lead_time_days integer;
