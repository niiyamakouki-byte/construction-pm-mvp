-- ============================================================
-- Subscriptions table for Stripe billing integration
-- ============================================================

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users on delete cascade,
  plan                   text not null default 'free'
    check (plan in ('free', 'standard', 'pro')),
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text not null default 'active'
    check (status in ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id)
);

-- ── updated_at trigger ───────────────────────────────────────
drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- ── indexes ──────────────────────────────────────────────────
create index if not exists subscriptions_user_id_idx on public.subscriptions (user_id);
create index if not exists subscriptions_stripe_customer_id_idx on public.subscriptions (stripe_customer_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;

-- Users can read their own subscription
drop policy if exists "users can read own subscription" on public.subscriptions;
create policy "users can read own subscription"
on public.subscriptions for select to authenticated
using (user_id = auth.uid());

-- Users can insert their own subscription row
drop policy if exists "users can insert own subscription" on public.subscriptions;
create policy "users can insert own subscription"
on public.subscriptions for insert to authenticated
with check (user_id = auth.uid());

-- Users can update their own subscription
drop policy if exists "users can update own subscription" on public.subscriptions;
create policy "users can update own subscription"
on public.subscriptions for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
