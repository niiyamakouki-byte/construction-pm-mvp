-- ============================================================
-- 020: api_rate_limits（API レートリミット用固定バケット）
--
-- /api/invoice-ocr のような有料 API 呼び出しを
-- 「ユーザー × エンドポイント × 1分ウィンドウ」単位でカウントする。
--
-- window_start は UTC で分単位に丸めた時刻。
-- increment_api_rate_limit(user, endpoint, window_start) RPC を経由して
-- UPSERT + returning count で原子的にインクリメントする。
-- ============================================================

create table if not exists public.api_rate_limits (
  user_id       uuid not null references auth.users on delete cascade,
  endpoint      text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, endpoint, window_start)
);

create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits (window_start);

-- ── RLS ──────────────────────────────────────────────────────
-- 書き込みは service_role 限定。認証ユーザーは自分の分だけ read できる（デバッグ用途）。
alter table public.api_rate_limits enable row level security;

drop policy if exists "users can read own rate limits" on public.api_rate_limits;
create policy "users can read own rate limits"
on public.api_rate_limits for select to authenticated
using (user_id = auth.uid());

-- ── 原子的インクリメント RPC ─────────────────────────────────
-- UPSERT で count を +1 し、最新の count を返す。
create or replace function public.increment_api_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_window_start timestamptz
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.api_rate_limits (user_id, endpoint, window_start, count, updated_at)
  values (p_user_id, p_endpoint, p_window_start, 1, now())
  on conflict (user_id, endpoint, window_start) do update
    set count = public.api_rate_limits.count + 1,
        updated_at = now()
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.increment_api_rate_limit(uuid, text, timestamptz) from public;
grant execute on function public.increment_api_rate_limit(uuid, text, timestamptz)
  to authenticated, service_role;
