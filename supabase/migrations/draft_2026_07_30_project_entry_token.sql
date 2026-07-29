-- Migration: QR入場 entry_token 方式 (Phase 1/2: projects.entry_token 列)
-- 作成のみ（適用禁止）。本番適用は光輝さんGO後に司令塔が実施する。
--
-- 背景 (laporta-beads-g6sf):
-- anon key は projects テーブルを一切SELECTできない(RLSにanon向けポリシーが無い)。
-- site_entry_records の anon INSERT/UPDATE ポリシーは
--   WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE id = project_id))
-- に依存しているが、このEXISTS判定はクエリ実行ロール(anon)の可視性に従うため、
-- anonからprojectsが不可視である限り常にfalseとなり、QR入場のanon書込みは
-- 42501 (RLS violation) で拒否され続ける(2026-07-30実測、k8oe参照)。
--
-- 不採用案: projectsテーブルにanon向けSELECTポリシーを追加する案は、
-- 住所・顧客名等の他カラムまで晒すリスクがあるため不採用(司令塔判断)。
--
-- 採用案: プロジェクト単位で発行・失効可能な「推測不能トークン」を
-- projects に持たせ、anon の書込み可否を token 一致で判定する
-- entry_token 方式に切替える。RLSポリシー本体は
-- draft_2026_07_30_entry_token_rls.sql (本ファイルの後に適用) で変更する。

alter table public.projects
  add column if not exists entry_token text unique;

-- 既存プロジェクトへの初回発行。
-- gen_random_uuid() は PostgreSQL 13+ の組み込み関数(pgcrypto拡張は不要)。
-- UUID×2連結で256bit相当のエントロピーを確保する。
update public.projects
set entry_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where entry_token is null;

comment on column public.projects.entry_token is
  'QR入場anon書込み用のプロジェクト単位トークン(laporta-beads-g6sf)。NULL = そのプロジェクトのQR入場を無効化(失効)。'
  '再発行(ローテーション)/失効は、projectsに既存の "authenticated can manage projects" FOR ALL ポリシー'
  '(001_initial_schema.sql) 経由で通常の UPDATE projects SET entry_token = ... / NULL で行う。'
  '追加のRLSポリシーは不要。';

-- ── 本番適用手順 (owner GO後に司令塔が実行。今回は作成のみで未実行) ───────────
-- SB_PW="$(cat /tmp/sb_pw_dec.txt)" npx -y -p pg node -e "
--   const { readFileSync } = require('node:fs');
--   const pg = require('pg');
--   const client = new pg.Client({
--     host: 'aws-1-ap-northeast-1.pooler.supabase.com', port: 5432, database: 'postgres',
--     user: 'postgres.iumymkvhrqwfexlthplm', password: process.env.SB_PW.trim(), ssl: true,
--   });
--   (async () => {
--     await client.connect();
--     await client.query(readFileSync('supabase/migrations/draft_2026_07_30_project_entry_token.sql', 'utf8'));
--     console.log('applied');
--     await client.end();
--   })();
-- "
