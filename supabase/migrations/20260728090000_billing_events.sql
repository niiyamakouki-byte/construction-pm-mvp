-- Provenance: LAPOSITE-STRIPE-IDEMPOTENCY-20260728 / Codex
-- Stripe webhook の event.id をDBで一意にし、再送時の副作用重複を防ぐ。

create table if not exists public.billing_events (
  stripe_event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.billing_events is
  'Stripe webhook events claimed by stripe_event_id for idempotent processing';

alter table public.billing_events enable row level security;

-- Webhook は service_role でのみ読み書きする。anon/authenticated 向け policy は作らない。
revoke all on table public.billing_events from anon, authenticated;
