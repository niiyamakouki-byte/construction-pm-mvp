-- Fix: organization_members の RLS 無限再帰を解消
-- 再帰せずに user_id を直接比較する

DROP POLICY IF EXISTS "members can read own memberships" ON public.organization_members;
CREATE POLICY "members can read own memberships"
ON public.organization_members FOR SELECT TO authenticated
USING (user_id = auth.uid());
