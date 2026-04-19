/**
 * freee OAuth クライアント — 認可 URL 生成とコード交換。
 *
 * freee REST API の OAuth 2.0 は Authorization Code Grant。
 *   1. ユーザーを https://accounts.secure.freee.co.jp/public_api/authorize に飛ばす
 *   2. freee から ?code=... で callback に戻ってくる
 *   3. code を /public_api/token に POST して access_token / refresh_token を得る
 *
 * 参考: https://app.secure.freee.co.jp/developers/api
 *
 * Note: 既存の `src/lib/freee/client.ts` は FREEE_ACCESS_TOKEN 固定トークン前提の
 * REST クライアント。本ファイルは OAuth フロー専用で、取得したトークンを
 * Supabase に保管したあとは `freee-api.ts` が実 API 呼び出しを担う。
 */

// ── 定数 ──────────────────────────────────────────────

export const FREEE_OAUTH_BASE = "https://accounts.secure.freee.co.jp";
export const FREEE_TOKEN_ENDPOINT = `${FREEE_OAUTH_BASE}/public_api/token`;
export const FREEE_AUTHORIZE_ENDPOINT = `${FREEE_OAUTH_BASE}/public_api/authorize`;

/** freee アクセストークンの有効期限（秒）。公式仕様は 6 時間 = 21600 秒。 */
export const FREEE_TOKEN_TTL_SECONDS = 6 * 60 * 60;

// ── 型 ────────────────────────────────────────────────

export type FreeeTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;   // "bearer"
  expires_in: number;   // 秒数。通常 21600
  scope?: string;
  created_at?: number;
};

export type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

// ── 認可 URL ───────────────────────────────────────────

/**
 * freee 認可画面の URL を組み立てる。
 * state には CSRF 対策用のランダム値を入れる（呼び出し側で管理）。
 */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(FREEE_AUTHORIZE_ENDPOINT);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  return url.toString();
}

// ── トークン交換 ─────────────────────────────────────────

/**
 * code を access_token / refresh_token に交換する。
 * fetch をモック可能にするため明示的に受け取る。
 */
export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FreeeTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });

  const response = await fetchImpl(FREEE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `freee token exchange failed: ${response.status}${text ? ` ${text}` : ""}`,
    );
  }

  return response.json() as Promise<FreeeTokenResponse>;
}

/**
 * refresh_token を使って新しい access_token を取得する。
 */
export async function refreshAccessToken(
  config: Omit<OAuthConfig, "redirectUri">,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FreeeTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetchImpl(FREEE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `freee token refresh failed: ${response.status}${text ? ` ${text}` : ""}`,
    );
  }

  return response.json() as Promise<FreeeTokenResponse>;
}

// ── 有効期限計算 ─────────────────────────────────────────

/**
 * token response から Supabase 保管用の expires_at (ISO 8601) を計算する。
 * created_at がある場合はそれを基準に、無ければ現在時刻を基準にする。
 */
export function computeExpiresAt(
  token: FreeeTokenResponse,
  now: Date = new Date(),
): string {
  const baseMs =
    typeof token.created_at === "number"
      ? token.created_at * 1000
      : now.getTime();
  const expiresMs = baseMs + token.expires_in * 1000;
  return new Date(expiresMs).toISOString();
}
