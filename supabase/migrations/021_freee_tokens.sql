-- ============================================================
-- 021: freee_tokens (freee OAuth アクセストークン保管)
--
-- freee 会計 API の OAuth 2.0 フローで取得したトークンを
-- ユーザー単位で保管する。freee のアクセストークン有効期限は
-- 6 時間なので、refresh_token を使って定期的に更新する。
--
-- 想定アクセス:
--   - Insert/Update は service_role（/api/freee/callback, /api/freee/refresh）
--   - Select は自分の行のみ（UI が接続状態を確認するため）
-- ============================================================

create table if not exists public.freee_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,
  company_id      bigint,
  scope           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id)
);

-- ── updated_at trigger ───────────────────────────────────────
drop trigger if exists set_freee_tokens_updated_at on public.freee_tokens;
create trigger set_freee_tokens_updated_at
before update on public.freee_tokens
for each row execute function public.set_updated_at();

-- ── indexes ──────────────────────────────────────────────────
create index if not exists freee_tokens_user_id_idx on public.freee_tokens (user_id);
create index if not exists freee_tokens_expires_at_idx on public.freee_tokens (expires_at);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.freee_tokens enable row level security;

-- 自分の行を読める（UI が「freee 接続済み」を判定するため）
drop policy if exists "users can read own freee token" on public.freee_tokens;
create policy "users can read own freee token"
on public.freee_tokens for select to authenticated
using (user_id = auth.uid());

-- Insert/Update/Delete は基本 service_role 経由。
-- 認証ユーザー自身が自分の行を削除（連携解除）できるようにする。
drop policy if exists "users can delete own freee token" on public.freee_tokens;
create policy "users can delete own freee token"
on public.freee_tokens for delete to authenticated
using (user_id = auth.uid());
