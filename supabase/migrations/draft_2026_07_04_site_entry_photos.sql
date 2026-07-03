-- Migration: QR入場×写真2枚ワークフロー Phase 1
-- 作成のみ（適用禁止）。本番適用は司令塔が検証後に行う。
--
-- 前提: site_entry_records テーブルは本番DBに既存で、以下の列が存在する:
--   id, project_id, organization_id, worker_name, company_name, entry_at, exit_at, entry_type, notes, created_at, updated_at
--
-- 本マイグレーションは上記に存在しない列のみを追加する。

-- ── site_entry_records カラム追加 ────────────────────────────────────────────

ALTER TABLE site_entry_records
  ADD COLUMN IF NOT EXISTS job_type text,
  ADD COLUMN IF NOT EXISTS start_photo_id uuid,
  ADD COLUMN IF NOT EXISTS end_photo_id uuid,
  ADD COLUMN IF NOT EXISTS task_id uuid;

-- ── RLS ポリシー案（コメント）────────────────────────────────────────────────
-- セキュリティ判断待ち: per-project entry_token 方式に強化する選択肢
-- （現在は anon が project_id の存在チェックのみで書き込める弱い設計）

-- anon INSERT: project_id が存在する projects を参照するもののみ
-- CREATE POLICY "anon_insert_site_entry" ON site_entry_records
--   FOR INSERT
--   TO anon
--   WITH CHECK (
--     EXISTS (SELECT 1 FROM projects WHERE id = project_id)
--   );

-- anon UPDATE: 同日レコードの exit_at / end_photo_id のみ更新可
-- CREATE POLICY "anon_update_site_entry" ON site_entry_records
--   FOR UPDATE
--   TO anon
--   USING (
--     entry_at::date = CURRENT_DATE
--   )
--   WITH CHECK (
--     EXISTS (SELECT 1 FROM projects WHERE id = project_id)
--   );

-- anon SELECT: 当日分のみ
-- CREATE POLICY "anon_select_site_entry" ON site_entry_records
--   FOR SELECT
--   TO anon
--   USING (entry_at::date = CURRENT_DATE);

-- ── photos テーブル・storage への anon ポリシー案（コメント）────────────────
-- photos テーブル: anon INSERT（category='start'|'end'|'progress' のみ）
-- CREATE POLICY "anon_insert_photos" ON photos
--   FOR INSERT
--   TO anon
--   WITH CHECK (
--     category IN ('start', 'end', 'progress')
--     AND EXISTS (SELECT 1 FROM projects WHERE id = project_id)
--   );

-- storage bucket "site-entry-photos" への anon upload:
-- storage のポリシーは Supabase Dashboard > Storage > Policies で設定。
-- 推奨: INSERT のみ許可、DELETE 禁止、READ は signed URL のみ。
-- CREATE POLICY "anon_upload_site_entry_photos"
--   ON storage.objects FOR INSERT TO anon
--   WITH CHECK (bucket_id = 'site-entry-photos');
