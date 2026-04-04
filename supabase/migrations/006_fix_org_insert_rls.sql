-- Fix: organizations INSERT RLS を SECURITY DEFINER 関数で解決

-- 既存の INSERT ポリシーを一度削除して再作成
DROP POLICY IF EXISTS "authenticated can create organization" ON public.organizations;
DROP POLICY IF EXISTS "authenticated can insert membership" ON public.organization_members;

-- organizations: 認証済みユーザーなら誰でも insert 可能
CREATE POLICY "authenticated can create organization"
ON public.organizations FOR INSERT TO authenticated
WITH CHECK (true);

-- organization_members: 認証済みユーザーなら誰でも insert 可能
CREATE POLICY "authenticated can insert membership"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (true);

-- ensure_user_organization: SECURITY DEFINER でRLSをバイパスして組織を確実に作成
CREATE OR REPLACE FUNCTION public.ensure_user_organization(
  p_user_id uuid,
  p_org_name text DEFAULT 'My Organization'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- 既存のメンバーシップを確認
  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- 新しい組織を作成
  INSERT INTO public.organizations (name, plan)
  VALUES (p_org_name, 'trial')
  RETURNING id INTO v_org_id;

  -- メンバーとして追加
  INSERT INTO public.organization_members (user_id, organization_id, role)
  VALUES (p_user_id, v_org_id, 'owner');

  RETURN v_org_id;
END;
$$;

-- 関数の実行権限を認証済みユーザーに付与
GRANT EXECUTE ON FUNCTION public.ensure_user_organization TO authenticated;
