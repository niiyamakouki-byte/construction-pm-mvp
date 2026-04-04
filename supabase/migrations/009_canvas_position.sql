-- ============================================================
-- 009: canvas position on tasks for node canvas view
-- ============================================================

-- ── tasks: キャンバス座標カラム ────────────────────────────────
alter table public.tasks
  add column if not exists canvas_x real,
  add column if not exists canvas_y real;
