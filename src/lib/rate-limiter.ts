/**
 * rate-limiter — Supabase バックエンドの固定バケット方式レートリミッタ。
 *
 * api_rate_limits テーブル（migration 020）を使い、
 * user_id × endpoint × window_start のキーでカウンタを管理する。
 *
 * - 1 分の固定ウィンドウに丸める（window_start = floor(now / 60s)）
 * - UPSERT で count をインクリメントする
 * - count が limit を超えたら 429 を返す想定
 */

export type RateLimitDecision =
  | { allowed: true; remaining: number; resetAt: Date }
  | { allowed: false; retryAfterSeconds: number; resetAt: Date };

export type RateLimitOptions = {
  userId: string;
  endpoint: string;
  limit: number;
  /** ウィンドウ長（秒）。デフォルト 60 秒。 */
  windowSeconds?: number;
  /** テスト用：現在時刻を注入できる。 */
  now?: () => Date;
};

/**
 * Supabase からの最小限インターフェース。本番では @supabase/supabase-js のクライアントを渡すが、
 * テストではこの形のモックを渡す。
 */
export type RateLimitStore = {
  /**
   * (user_id, endpoint, window_start) をキーに count をインクリメントして現在値を返す。
   * 行が無ければ count=1 で作成する。
   */
  increment: (key: {
    userId: string;
    endpoint: string;
    windowStart: Date;
  }) => Promise<{ count: number; error: { message: string } | null }>;
};

/**
 * now を 60 秒（または windowSeconds）の境界に切り下げる。
 */
export function computeWindowStart(now: Date, windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/**
 * レートリミットを 1 回分消費する。
 *
 * - 許可時: allowed=true + remaining
 * - 拒否時: allowed=false + retryAfterSeconds（秒）
 * - ストア障害時: fail-open（allowed=true）。
 *   課金系 API の可用性を優先しつつ、障害は console.error に残す。
 */
export async function consumeRateLimit(
  store: RateLimitStore,
  options: RateLimitOptions,
): Promise<RateLimitDecision> {
  const windowSeconds = options.windowSeconds ?? 60;
  const now = (options.now ?? (() => new Date()))();
  const windowStart = computeWindowStart(now, windowSeconds);
  const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);

  const result = await store.increment({
    userId: options.userId,
    endpoint: options.endpoint,
    windowStart,
  });

  if (result.error) {
    // fail-open: ストア障害で可用性を落とさない
    console.error("[rate-limiter] store error:", result.error.message);
    return {
      allowed: true,
      remaining: options.limit,
      resetAt,
    };
  }

  if (result.count > options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000),
    );
    return { allowed: false, retryAfterSeconds, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - result.count),
    resetAt,
  };
}

/**
 * Supabase クライアントから RateLimitStore を生成する。
 * api_rate_limits テーブル（migration 020）を前提とする。
 */
export function createSupabaseRateLimitStore(supabase: {
  // ponytail: supabase-js の rpc() も upsert() 同様 thenable(PostgrestFilterBuilder)
  // を返す。PromiseLike にして実体とのドリフトを防ぐ。
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}): RateLimitStore {
  return {
    async increment({ userId, endpoint, windowStart }) {
      const { data, error } = await supabase.rpc("increment_api_rate_limit", {
        p_user_id: userId,
        p_endpoint: endpoint,
        p_window_start: windowStart.toISOString(),
      });
      if (error) return { count: 0, error };
      const count = typeof data === "number" ? data : Number(data) || 0;
      return { count, error: null };
    },
  };
}
