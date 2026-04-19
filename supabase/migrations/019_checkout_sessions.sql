-- ============================================================
-- 019: checkout_sessions (Stripe Checkout セッション作成ログ)
--
-- Stripe Checkout Session を作成した記録を残すためのテーブル。
-- 実際のサブスクリプション状態は public.subscriptions（migration 010）
-- が Stripe Webhook から更新される想定。
-- このテーブルはセッション作成履歴・監査・再送診断のためのログ。
-- ============================================================

create table if not exists public.checkout_sessions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid references auth.users on delete set null,
  organization_id           uuid references public.organizations(id) on delete set null,
  plan                      text not null
    check (plan in ('free', 'standard', 'pro')),
  stripe_session_id         text not null unique,
  stripe_price_id           text not null,
  mode                      text not null default 'subscription'
    check (mode in ('subscription', 'payment')),
  status                    text not null default 'created'
    check (status in ('created', 'completed', 'expired', 'canceled')),
  amount_total              integer,
  currency                  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- ── updated_at trigger ───────────────────────────────────────
drop trigger if exists set_checkout_sessions_updated_at on public.checkout_sessions;
create trigger set_checkout_sessions_updated_at
before update on public.checkout_sessions
for each row execute function public.set_updated_at();

-- ── indexes ──────────────────────────────────────────────────
create index if not exists checkout_sessions_user_id_idx on public.checkout_sessions (user_id);
create index if not exists checkout_sessions_organization_id_idx on public.checkout_sessions (organization_id);
create index if not exists checkout_sessions_stripe_session_id_idx on public.checkout_sessions (stripe_session_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.checkout_sessions enable row level security;

-- Users can read their own checkout sessions
drop policy if exists "users can read own checkout sessions" on public.checkout_sessions;
create policy "users can read own checkout sessions"
on public.checkout_sessions for select to authenticated
using (user_id = auth.uid());

-- Insert/update は原則 service_role（サーバーサイド）から行う想定。
-- 認証ユーザー自身が自分の行を insert することも許可する（フォールバック）。
drop policy if exists "users can insert own checkout sessions" on public.checkout_sessions;
create policy "users can insert own checkout sessions"
on public.checkout_sessions for insert to authenticated
with check (user_id = auth.uid());
