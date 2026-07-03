-- Draft Migration: authenticated_full_access ポリシー追加（適用は司令塔判断後）
--
-- 背景: 既存の org-scoped ポリシー（org members can manage ...）は
-- WITH CHECK (organization_id IN (SELECT ... FROM organization_members ...)) のため、
-- コードが organization_id を送らない（NULL）と INSERT が全滅する。
-- 現実は単一テナント（organizations=1, users=1）で、projects/tasks は既に
-- authenticated_full_access（併存でOR評価）により NULL org で運用されている。
-- 本マイグレーションは adapter 系テーブルに同じ緩和ポリシーを併設する。
--
-- ⚠ マルチテナント（GenbaHub有料化）前に必ず引き締めること:
--   1. 全行の organization_id をバックフィル
--   2. コード側で organization_id を必ず送る
--   3. authenticated_full_access を全テーブルから DROP
--   （bd票で追跡する）

-- ── 既存テーブル（org-scopedポリシーのみの19卓） ──────────────────────────
CREATE POLICY "authenticated_full_access" ON change_requests    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON chat_messages      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON cost_items         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON customers          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON daily_reports      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON deals              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON drawing_pins       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON estimates          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON expenses           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON invoices           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON ky_activities      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON mood_boards        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON near_miss_reports  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON purchase_orders    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON resources          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON safety_documents   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON selection_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON site_entry_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON team_members       FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 新設テーブル（draft_2026_07_04_missing_adapter_tables.sql で作成される19卓） ──
-- ※ missing_adapter_tables 適用後に実行すること
CREATE POLICY "authenticated_full_access" ON punch_list_items        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON punch_list_history      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON insurance_claims        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON claim_documents         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON claim_disputes          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON compliance_requirements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON compliance_audit_log    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON permit_applications     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON permit_inspections      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON labor_time_entries      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON crew_assignments        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON meeting_minutes         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON meeting_action_items    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON equipment_rentals       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON equipment_usage_logs    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON warranty_items          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON warranty_claims         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON phases                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_full_access" ON phase_status_history    FOR ALL TO authenticated USING (true) WITH CHECK (true);
