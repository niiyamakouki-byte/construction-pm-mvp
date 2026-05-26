-- WARN潰し: SECURITY DEFINER 関数の anon EXECUTE 剥奪
-- supabase advisor 0028 / 0029 のうち anon (未ログイン) 経路を閉じる。
-- authenticated / service_role の EXECUTE は維持。
--
-- 対象:
--   - ensure_user_organization(uuid, text)
--     新規ユーザーの組織自動作成。ログイン後の呼び出しのみ想定。
--   - increment_api_rate_limit(uuid, text, timestamptz)
--     API レート制限。サインイン済みユーザー単位。
--   - is_project_org_member(text)
--     RLS から呼ばれる組織メンバー判定。anon は対象テーブルにそもそも触れない。

revoke execute on function public.ensure_user_organization(uuid, text) from anon, public;
revoke execute on function public.increment_api_rate_limit(uuid, text, timestamptz) from anon, public;
revoke execute on function public.is_project_org_member(text) from anon, public;
