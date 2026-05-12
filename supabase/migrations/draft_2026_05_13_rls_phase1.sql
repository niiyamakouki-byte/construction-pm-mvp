-- ============================================================
-- DRAFT: Phase 1 RLS Policy (projects/tasks/documents/document_versions)
-- 作成日: 2026-05-13 (JST)
-- 状態: 未適用 (光輝さんの承認待ち)
-- ============================================================
--
-- 前提:
--   - 現状 projects.organization_id は全件 null (単一テナント運用)
--   - 多テナント化は Phase 3+ で対応
--   - 当面は「authenticated ロール = 光輝さん本人」前提で全行アクセス可
--   - anon ロールは完全遮断 (公開URL/施主ポータルは別途 share-token で対応)
--
-- リスク:
--   - service_role キーが漏れたら全データ抜ける (これは RLS の対象外)
--   - 認証ユーザーが追加された瞬間に「全員が全プロジェクト見える」状態になる
--     → ユーザー追加前に organization_id 埋めと multi-tenant policy 化が必要
-- ============================================================

-- 1. RLS 有効化
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;

-- 2. authenticated ユーザーに全行アクセス許可 (単一テナント前提)
CREATE POLICY "authenticated_full_access" ON public.projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON public.document_versions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. anon ロールは Policy なし = 完全遮断 (デフォルト動作)
--    施主向け公開は share-token 経由で service_role + edge function でラップ
