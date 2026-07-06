-- Draft: project-documents storage bucket for the Documents-tab drag & drop import.
-- NOT applied to production yet — apply only after 光輝さん's go-ahead, mirroring
-- how 014_construction_photos_storage.sql was introduced for photos.
--
-- Existing `documents` / `document_versions` tables (see draft_2026_07_04_missing_adapter_tables.sql
-- or the production schema) already store a `url` text column, so no new table is required —
-- this bucket only holds the uploaded file bytes; metadata continues to live in `documents`.

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

-- RLS: same org-membership check already defined for photos (public.is_project_org_member).
-- Storage object policies scoped by the leading `${projectId}/...` path segment.
drop policy if exists "project_documents_select_org_members" on storage.objects;
create policy "project_documents_select_org_members"
on storage.objects for select
using (
  bucket_id = 'project-documents'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "project_documents_insert_org_members" on storage.objects;
create policy "project_documents_insert_org_members"
on storage.objects for insert
with check (
  bucket_id = 'project-documents'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "project_documents_delete_org_members" on storage.objects;
create policy "project_documents_delete_org_members"
on storage.objects for delete
using (
  bucket_id = 'project-documents'
  and public.is_project_org_member((storage.foldername(name))[1])
);
