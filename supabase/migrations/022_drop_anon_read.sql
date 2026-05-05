-- ============================================================
-- P0-1 セキュリティ修正: anon READ ポリシーを全テーブルから削除
-- 002_genba_hub_schema.sql で作成された "anon can read *" ポリシーは
-- 認証なし全公開のため削除する。
-- 004_add_org_id.sql の org_members フィルタポリシーで十分。
-- ============================================================

-- projects (002 で作成、004 で DROP 済みの可能性があるが念のため)
drop policy if exists "anon can read projects" on public.projects;

-- tasks (002 で作成、004 で DROP 済みの可能性があるが念のため)
drop policy if exists "anon can read tasks" on public.tasks;

-- daily_reports
drop policy if exists "anon can read daily reports" on public.daily_reports;

-- estimates
drop policy if exists "anon can read estimates" on public.estimates;

-- expenses
drop policy if exists "anon can read expenses" on public.expenses;

-- team_members (002 で作成、004 で DROP 済みの可能性があるが念のため)
drop policy if exists "anon can read team members" on public.team_members;
