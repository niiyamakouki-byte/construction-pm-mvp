-- 032: project-documents storage bucket + RLS policies for the Documents-tab drag & drop import.
-- Promoted from draft_2026_07_07_project_documents_storage.sql (bucket half was already live in
-- production; the storage.objects policies below were missing, so every authenticated upload
-- failed with 403 "new row violates row-level security policy").
-- Mirrors 014_construction_photos_storage.sql: same public.is_project_org_member() check,
-- objects scoped by the leading `${projectId}/...` path segment, policies granted `to authenticated`.
-- 来歴: wave-20260712-renpa PDFビューアー公開ブロッカー修正 / Claude worker (後継) 2026-07-12
-- 検証: tasks/wave-20260712-renpa/storage-policy-check.mjs

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 本番の全projects行はorganization_idがnull(org移行前のレガシーデータ)のため、
-- 従来のis_project_org_memberは常にfalseとなり、写真/ドキュメントのStorageアップロードが
-- 一律403になっていた。テーブル側RLSは2026-07-04適用のauthenticated_full_accessで
-- 「認証済みなら全件可」の運用なので、org未設定案件は認証ユーザー全員に開放して整合させる。
-- organization_idが設定された案件は従来どおりorgメンバーのみ。
create or replace function public.is_project_org_member(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and (
        p.organization_id is null
        or exists (
          select 1
          from public.organization_members om
          where om.organization_id = p.organization_id
            and om.user_id = auth.uid()
        )
      )
  );
$$;

drop policy if exists "project_documents_select_org_members" on storage.objects;
create policy "project_documents_select_org_members"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-documents'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "project_documents_insert_org_members" on storage.objects;
create policy "project_documents_insert_org_members"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-documents'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "project_documents_delete_org_members" on storage.objects;
create policy "project_documents_delete_org_members"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-documents'
  and public.is_project_org_member((storage.foldername(name))[1])
);
