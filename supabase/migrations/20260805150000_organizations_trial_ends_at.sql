-- ============================================================
-- trial_ends_at: 14日間フル機能トライアルの期限管理
-- 設計: docs/trial-to-paid-transition.md
-- ============================================================

alter table public.organizations
  add column if not exists trial_ends_at timestamptz;

-- 既存のtrial組織へ created_at + 14日 を後付け（今日時点で無期限に丸まっていたぶんの救済）
update public.organizations
  set trial_ends_at = created_at + interval '14 days'
  where trial_ends_at is null and plan = 'trial';

-- 新規organization作成時に trial_ends_at = 作成時刻 + 14日 を自動セット
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
  organization_id_value uuid;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception using errcode = '42501', message = 'users may create only their own organization';
  end if;

  select member.organization_id
  into organization_id_value
  from public.organization_members member
  where member.user_id = p_user_id
  order by member.created_at, member.organization_id
  limit 1;

  if organization_id_value is not null then
    return organization_id_value;
  end if;

  insert into public.organizations (name, plan, trial_ends_at)
  values (coalesce(nullif(btrim(p_org_name), ''), 'My Organization'), 'trial', now() + interval '14 days')
  returning id into organization_id_value;

  insert into public.organization_members (user_id, organization_id, role)
  values (p_user_id, organization_id_value, 'owner');

  return organization_id_value;
end
$$;

revoke all on function public.ensure_user_organization(uuid, text) from public, anon;
grant execute on function public.ensure_user_organization(uuid, text) to authenticated;
