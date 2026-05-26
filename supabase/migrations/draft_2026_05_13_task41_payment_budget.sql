-- ============================================================
-- DRAFT: Task #41 — プロジェクト単位の入金計画 + 実行予算 + freee連携
-- 作成日: 2026-05-13 (JST)
-- 状態: 未適用 (光輝さん承認待ち)
-- ============================================================
--
-- 既存テーブルとの位置づけ:
--   - deals (CRM)        : 案件パイプライン (受注前)
--   - invoices           : 発行請求書 (売掛、入金実績の起点)
--   - expenses           : 立替・経費 (アウトフロー実績)
--   - cost_items         : 工事原価行 (タスク単位の実績)
--   - e-contracts        : 電子契約 + PaymentPlan (受注時の入金スケジュール起点)
--
-- 新規 2 テーブル:
--   1. project_payment_plans  : 入金計画 (予定 × 実績の対比)
--   2. execution_budgets      : 実行予算 (カテゴリ別の予算枠 vs 消化)
--
-- freee 連携:
--   - 既存 freee_tokens テーブル + freee Webhook (#35 完了済) を再利用
--   - project_payment_plans.freee_deal_id で freee 取引と紐付け
--   - execution_budgets は freee 側の勘定科目とカテゴリを揃える (separate sync ジョブ)
-- ============================================================

-- 1. 入金計画
CREATE TABLE IF NOT EXISTS public.project_payment_plans (
  id                 text PRIMARY KEY,
  project_id         text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id    uuid,
  milestone_label    text NOT NULL,         -- 例: "契約金" "中間金" "完工金"
  scheduled_date     date NOT NULL,
  scheduled_amount   numeric NOT NULL,
  invoice_id         uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  actual_paid_date   date,
  actual_amount      numeric,
  freee_deal_id      text,                  -- freee 側の取引ID (突合用)
  status             text NOT NULL DEFAULT 'planned',  -- planned / invoiced / paid / overdue / cancelled
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_plans_project ON public.project_payment_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_scheduled ON public.project_payment_plans(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_payment_plans_freee ON public.project_payment_plans(freee_deal_id);

-- 2. 実行予算
CREATE TABLE IF NOT EXISTS public.execution_budgets (
  id                 text PRIMARY KEY,
  project_id         text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id    uuid,
  category           text NOT NULL,          -- 解体, 内装, 電気, 給排水, 諸経費 etc (cost-master と揃える)
  planned_amount     numeric NOT NULL,
  committed_amount   numeric NOT NULL DEFAULT 0,  -- 発注済 (purchase_orders 合計)
  actual_amount      numeric NOT NULL DEFAULT 0,  -- 確定 (expenses + invoices 合計)
  freee_account_code text,                   -- freee 勘定科目コード
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_exec_budgets_project ON public.execution_budgets(project_id);
CREATE INDEX IF NOT EXISTS idx_exec_budgets_category ON public.execution_budgets(project_id, category);

-- 3. RLS (Phase 1 RLS draft と同じ方針: authenticated 全行可、anon 遮断)
ALTER TABLE public.project_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_budgets    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.project_payment_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.execution_budgets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. 自動 updated_at (既存 trigger 関数があれば再利用、なければ追加)
-- 注: handle_updated_at() が他テーブルで使われていれば省略可。要確認。
CREATE OR REPLACE FUNCTION public.handle_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.project_payment_plans;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.project_payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.execution_budgets;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.execution_budgets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
