-- ============================================================
-- 034: customers.organization_id の NOT NULL 撤去
-- 作成日: 2026-07-12 (JST)
-- 状態: 2026-07-12 Management API経由で本番適用済み (第3波ワーカー)
-- ============================================================
-- 背景: 本番は全projects/全データが organization_id 未設定運用で、
-- customers の RLS (authenticated_full_access) も organization_id IS NULL を
-- 明示的に許容している。にもかかわらず organization_id に NOT NULL 制約が
-- 残っていたため、アプリの CRM 顧客登録 INSERT (organization_id を送らない)
-- が 23502 で全滅していた。UI 側は fire-and-forget で握り潰すため、
-- 見かけ上成功しリロードで消えるサイレントデータロスになっていた。
-- 検証: tasks/wave-20260712-renpa/crm-customer-insert-check.mjs
--
-- NOTE: org機能を本稼働させる際は、NOT NULL復帰と既存NULL行の移行をセットで
-- 行うこと(032の申し送りと同じ扱い)。同種のNOT NULL org制約は
-- deals/invoices/purchase_orders 等13テーブルに残存(各テーブルはアプリの
-- 書き込み経路が通ったタイミングで個別に判断)。

ALTER TABLE public.customers ALTER COLUMN organization_id DROP NOT NULL;
