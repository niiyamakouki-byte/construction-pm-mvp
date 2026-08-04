-- ============================================================
-- 20260805: purchase_orders.task_id 追加
-- 票 laporta-beads-g0zed: 発注物(PurchaseOrder)を工程タスクに紐づけ、
-- ガント上に納期マーカーを表示するための紐づけ列。
-- ============================================================

alter table public.purchase_orders
  add column if not exists task_id text references public.project_tasks(id) on delete set null;

create index if not exists idx_purchase_orders_task on public.purchase_orders (task_id);
