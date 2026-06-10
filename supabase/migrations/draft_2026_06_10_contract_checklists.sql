-- ============================================================
-- DRAFT: 契約チェックリスト
-- 作成日: 2026-06-10 (JST)
-- 状態: 未適用
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contract_checklists (
  id               text PRIMARY KEY,
  project_id       text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id  uuid,
  item_key         text NOT NULL,
  checked          boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_contract_checklists_project ON public.contract_checklists(project_id);

ALTER TABLE public.contract_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON public.contract_checklists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS set_updated_at ON public.contract_checklists;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contract_checklists
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
