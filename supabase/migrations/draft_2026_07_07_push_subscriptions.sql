-- Draft: Web Push subscriptions for the PWA "standalone app" upgrade (二段ロケット 1段目).
-- Stores one row per browser/device push subscription, keyed by endpoint.
-- Writes go through the service-role API functions (api/push/*.ts); RLS below lets
-- an authenticated user read/manage only their own rows.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
on public.push_subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "push_subscriptions_modify_own" on public.push_subscriptions;
create policy "push_subscriptions_modify_own"
on public.push_subscriptions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
