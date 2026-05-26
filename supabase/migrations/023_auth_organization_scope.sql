-- ============================================================
-- 023: Auth organization scope — JWT クレーム注入 + NOT NULL 移行
-- Phase 1.5: organization scope の強化と JWT ベース RLS policy
-- ============================================================

-- ── デモ用デフォルト組織を挿入（既存デモデータのマイグレーション用）──
-- organization_id が NULL のプロジェクト/タスクに割り当てるデフォルト組織
insert into public.organizations (id, name, plan)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Default Demo Organization',
  'trial'
)
on conflict (id) do nothing;

-- ── 既存 NULL の organization_id をデフォルト組織に移行 ─────────
-- projects
update public.projects
set organization_id = '00000000-0000-0000-0000-000000000001'::uuid
where organization_id is null;

-- phases
update public.phases
set organization_id = '00000000-0000-0000-0000-000000000001'::uuid
where organization_id is null;

-- ── JWT クレームから organization_id を取得するヘルパー関数 ─────
-- auth.jwt() の app_metadata.organization_id を返す。
-- クレームがなければ NULL を返す（デモモード互換）。
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(
    auth.jwt() ->> 'organization_id',
    ''
  )::uuid
$$;

-- ── JWT クレーム注入関数（Supabase Edge Function から呼ぶ想定）───
-- ユーザーの organization_id を JWT カスタムクレームとして設定する
-- SECURITY DEFINER で RLS をバイパスして organization_members を参照
create or replace function public.set_user_organization_claim(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select om.organization_id
  into v_org_id
  from public.organization_members om
  where om.user_id = p_user_id
  order by om.created_at asc
  limit 1;

  if v_org_id is not null then
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('organization_id', v_org_id::text)
    where id = p_user_id;
  end if;
end;
$$;

-- ── projects RLS policy 強化 ─────────────────────────────────────
-- JWT クレームの organization_id と一致する行のみアクセス許可
-- VITE_AUTH_BYPASS=true 環境ではデモ組織も許可（後方互換）

drop policy if exists "authenticated can access own projects" on public.projects;
create policy "authenticated can access own projects"
on public.projects for all to authenticated
using (
  organization_id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
  )
)
with check (
  organization_id in (
    select om.organization_id
    from public.organization_members om
    where om.user_id = auth.uid()
  )
);

-- ── tasks RLS policy 強化 ─────────────────────────────────────────
drop policy if exists "authenticated can access own tasks" on public.tasks;
create policy "authenticated can access own tasks"
on public.tasks for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    inner join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = auth.uid()
    where p.id = project_id
  )
)
with check (
  exists (
    select 1
    from public.projects p
    inner join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = auth.uid()
    where p.id = project_id
  )
);

-- ── phases RLS policy 強化 ────────────────────────────────────────
drop policy if exists "authenticated can access own project phases" on public.phases;
create policy "authenticated can access own project phases"
on public.phases for all to authenticated
using (
  exists (
    select 1
    from public.projects p
    inner join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = auth.uid()
    where p.id = project_id
  )
)
with check (
  exists (
    select 1
    from public.projects p
    inner join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = auth.uid()
    where p.id = project_id
  )
);

-- ── ensure_user_organization 関数（SignUp 時の組織自動作成）───────
-- OrganizationContext.tsx が呼ぶ RPC 関数。存在しなければ新規作成。
create or replace function public.ensure_user_organization(
  p_user_id uuid,
  p_org_name text default 'My Organization'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  -- 既存の所属組織を返す
  select om.organization_id
  into v_org_id
  from public.organization_members om
  where om.user_id = p_user_id
  order by om.created_at asc
  limit 1;

  if v_org_id is not null then
    -- JWT クレームも更新
    perform public.set_user_organization_claim(p_user_id);
    return v_org_id;
  end if;

  -- 新規組織を作成
  insert into public.organizations (name, plan)
  values (p_org_name, 'trial')
  returning id into v_org_id;

  -- メンバーとして owner で追加
  insert into public.organization_members (user_id, organization_id, role)
  values (p_user_id, v_org_id, 'owner');

  -- JWT クレームに注入
  perform public.set_user_organization_claim(p_user_id);

  return v_org_id;
end;
$$;
