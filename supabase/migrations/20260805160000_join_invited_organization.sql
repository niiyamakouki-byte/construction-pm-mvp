-- ============================================================
-- join_invited_organization: 招待リンク経由の新規ユーザーを
-- 招待元organizationへ参加させる（AC③、票construction_pm_mvp-1g7）
--
-- 背景: ensure_user_organization は既存メンバーシップが無いユーザーに
-- 新規organizationを自動作成する（自己組織作成専用）。招待経由のユーザーに
-- そのまま使うと、招待先ではなく自分だけの新しいorganizationが作られてしまう
-- （docs/onboarding-flow.md で指摘済みのギャップ）。
-- 本関数はensure_user_organizationと同じ「既存メンバーシップがあればそれを返す」
-- 冪等パターンを踏襲しつつ、新規作成ではなく指定organizationへの参加のみ行う。
-- ============================================================

create or replace function public.join_invited_organization(
  p_user_id uuid,
  p_organization_id uuid,
  p_role text default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_org_id uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception using errcode = '42501', message = 'users may join organizations only for themselves';
  end if;

  select member.organization_id
  into existing_org_id
  from public.organization_members member
  where member.user_id = p_user_id
  order by member.created_at, member.organization_id
  limit 1;

  if existing_org_id is not null then
    return existing_org_id;
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception using errcode = '23503', message = 'invited organization does not exist';
  end if;

  insert into public.organization_members (user_id, organization_id, role)
  values (p_user_id, p_organization_id, coalesce(nullif(btrim(p_role), ''), 'member'));

  return p_organization_id;
end
$$;

revoke all on function public.join_invited_organization(uuid, uuid, text) from public, anon;
grant execute on function public.join_invited_organization(uuid, uuid, text) to authenticated;
