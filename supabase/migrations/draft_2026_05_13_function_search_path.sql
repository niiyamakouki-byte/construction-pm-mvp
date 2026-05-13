-- WARN潰し: function_search_path_mutable
-- handle_updated_at / set_updated_at の search_path を固定し
-- supabase database-linter の 0011 警告を解消する。
-- 関数本体は変更しない（updated_at セット動作は同一）。

alter function public.handle_updated_at() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
