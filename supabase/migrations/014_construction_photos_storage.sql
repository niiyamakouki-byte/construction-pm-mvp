-- Construction photo storage and metadata

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'construction-photos',
  'construction-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  task_id text references public.tasks(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  storage_bucket text not null default 'construction-photos',
  storage_path text not null unique,
  url text not null default '',
  file_name text not null,
  content_type text not null,
  file_size integer not null check (file_size > 0 and file_size <= 10485760),
  category text,
  caption text,
  taken_at timestamptz not null default timezone('utc', now()),
  uploader_id uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists photos_project_id_idx on public.photos (project_id);
create index if not exists photos_task_id_idx on public.photos (task_id);
create index if not exists photos_org_id_idx on public.photos (organization_id);
create index if not exists photos_taken_at_idx on public.photos (taken_at desc);

drop trigger if exists set_photos_updated_at on public.photos;
create trigger set_photos_updated_at
before update on public.photos
for each row execute function public.set_updated_at();

alter table public.photos enable row level security;

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
    join public.organization_members om on om.organization_id = p.organization_id
    where p.id = p_project_id
      and om.user_id = auth.uid()
  );
$$;

drop policy if exists "org members can read photos" on public.photos;
create policy "org members can read photos"
on public.photos for select to authenticated
using (public.is_project_org_member(project_id));

drop policy if exists "org members can insert photos" on public.photos;
create policy "org members can insert photos"
on public.photos for insert to authenticated
with check (public.is_project_org_member(project_id));

drop policy if exists "org members can delete photos" on public.photos;
create policy "org members can delete photos"
on public.photos for delete to authenticated
using (public.is_project_org_member(project_id));

drop policy if exists "org members can update photos" on public.photos;
create policy "org members can update photos"
on public.photos for update to authenticated
using (public.is_project_org_member(project_id))
with check (public.is_project_org_member(project_id));

drop policy if exists "org members can read construction photo objects" on storage.objects;
create policy "org members can read construction photo objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'construction-photos'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "org members can upload construction photo objects" on storage.objects;
create policy "org members can upload construction photo objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'construction-photos'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "org members can update construction photo objects" on storage.objects;
create policy "org members can update construction photo objects"
on storage.objects for update to authenticated
using (
  bucket_id = 'construction-photos'
  and public.is_project_org_member((storage.foldername(name))[1])
)
with check (
  bucket_id = 'construction-photos'
  and public.is_project_org_member((storage.foldername(name))[1])
);

drop policy if exists "org members can delete construction photo objects" on storage.objects;
create policy "org members can delete construction photo objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'construction-photos'
  and public.is_project_org_member((storage.foldername(name))[1])
);
