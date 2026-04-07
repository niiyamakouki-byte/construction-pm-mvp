create table if not exists public.documents (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null check (type in ('drawing', 'contract', 'permit', 'daily_report', 'photo', 'invoice', 'other')),
  url text not null,
  uploaded_by text not null,
  version text not null
);

create table if not exists public.document_versions (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  document_id text not null references public.documents(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null check (type in ('drawing', 'contract', 'permit', 'daily_report', 'photo', 'invoice', 'other')),
  url text not null,
  uploaded_by text not null,
  version text not null
);

create index if not exists documents_project_id_idx on public.documents (project_id);
create index if not exists documents_type_idx on public.documents (type);
create index if not exists document_versions_document_id_idx on public.document_versions (document_id);
create index if not exists document_versions_project_id_idx on public.document_versions (project_id);

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists set_document_versions_updated_at on public.document_versions;
create trigger set_document_versions_updated_at
before update on public.document_versions
for each row execute function public.set_updated_at();

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;

drop policy if exists "org members can access documents" on public.documents;
create policy "org members can access documents"
on public.documents
for select
to authenticated
using (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can insert documents" on public.documents;
create policy "org members can insert documents"
on public.documents
for insert
to authenticated
with check (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can update documents" on public.documents;
create policy "org members can update documents"
on public.documents
for update
to authenticated
using (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
)
with check (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can delete documents" on public.documents;
create policy "org members can delete documents"
on public.documents
for delete
to authenticated
using (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can access document versions" on public.document_versions;
create policy "org members can access document versions"
on public.document_versions
for select
to authenticated
using (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can insert document versions" on public.document_versions;
create policy "org members can insert document versions"
on public.document_versions
for insert
to authenticated
with check (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can update document versions" on public.document_versions;
create policy "org members can update document versions"
on public.document_versions
for update
to authenticated
using (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
)
with check (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);

drop policy if exists "org members can delete document versions" on public.document_versions;
create policy "org members can delete document versions"
on public.document_versions
for delete
to authenticated
using (
  project_id in (
    select id from public.projects
    where organization_id in (
      select org_id from public.user_organizations where user_id = auth.uid()
    )
  )
);
