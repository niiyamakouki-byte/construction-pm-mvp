-- laporta-beads-yf4or — Codex implementation, 2026-08-07.
-- DRAFT ONLY: owner approval前に本番適用しないこと。

create extension if not exists pgcrypto;

create table if not exists public.photo_shares (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint photo_shares_expiry_after_creation check (expires_at > created_at)
);

create index if not exists photo_shares_project_id_idx on public.photo_shares (project_id);
create index if not exists photo_shares_expires_at_idx on public.photo_shares (expires_at);

alter table public.photo_shares enable row level security;

drop policy if exists "project members can manage photo shares" on public.photo_shares;
create policy "project members can manage photo shares"
on public.photo_shares for all to authenticated
using (public.is_project_org_member(project_id))
with check (public.is_project_org_member(project_id));

-- Supabase RESTへ x-photo-share-token を付けたanonリクエストだけを許可する。
-- API経路はservice_roleで同じtoken_hash/期限/失効条件を検証し、短期署名URLを返す。
create or replace function public.has_valid_photo_share(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.photo_shares share
    where share.project_id = p_project_id
      and share.token_hash = encode(
        digest(
          coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-photo-share-token',
            ''
          ),
          'sha256'
        ),
        'hex'
      )
      and share.revoked_at is null
      and share.expires_at > timezone('utc', now())
  );
$$;

revoke all on function public.has_valid_photo_share(text) from public;
grant execute on function public.has_valid_photo_share(text) to anon, authenticated;

drop policy if exists "valid photo share can read photos" on public.photos;
create policy "valid photo share can read photos"
on public.photos for select to anon
using (public.has_valid_photo_share(project_id));

drop policy if exists "valid photo share can read construction photo objects" on storage.objects;
create policy "valid photo share can read construction photo objects"
on storage.objects for select to anon
using (
  bucket_id = 'construction-photos'
  and public.has_valid_photo_share((storage.foldername(name))[1])
);

comment on table public.photo_shares is
  '施主向け期限付き写真共有。生トークンは保存せずSHA-256ハッシュのみ保持する。';
