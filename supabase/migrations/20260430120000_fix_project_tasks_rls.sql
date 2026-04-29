-- Fix: project_tasks RLS — authenticated ユーザーが projects.organization_id 経由でアクセスできるよう補完
-- 既存ポリシー ("org members can manage project tasks") は organization_members にレコードがある前提。
-- projects.organization_id が NULL のレコード（旧データ・デモデータ）は organization_id IN (...) が
-- false になりアクセス不能になる。同一 project_id を持つプロジェクトへの直接アクセスを許可するポリシーを追加。

-- authenticated: project の owner として直接アクセスできるポリシー (organization_id NULL 対応)
drop policy if exists "authenticated can access own project tasks" on public.project_tasks;
create policy "authenticated can access own project tasks"
on public.project_tasks for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        -- org membership path (通常フロー)
        p.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = auth.uid()
        )
        -- direct project access when organization_id is NULL (demo / legacy data)
        or p.organization_id is null
      )
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and (
        p.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = auth.uid()
        )
        or p.organization_id is null
      )
  )
);
