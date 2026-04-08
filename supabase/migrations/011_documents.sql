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
