/**
 * LINE Login OAuth helper
 * https://developers.line.biz/ja/docs/line-login/
 *
 * env 未設定時はボタン無効化 (hasLineEnv() === false)
 * CSRF防止: state パラメータを sessionStorage に保存して callback で検証
 */

const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_CHANNEL_ID?.trim() ?? "";
const CALLBACK_PATH = "/auth/line/callback";

export function hasLineEnv(): boolean {
  return Boolean(LINE_CHANNEL_ID);
}

function getCallbackUri(): string {
  const origin =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? window.location.origin
      : "https://construction-pm-mvp.vercel.app";
  return `${origin}${CALLBACK_PATH}`;
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const STATE_KEY = "line_oauth_state";

/** LINE 認可ページへリダイレクト */
export function startLineLogin(): void {
  if (!hasLineEnv()) {
    throw new Error("LINE_CHANNEL_ID が設定されていません");
  }
  const state = generateState();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINE_CHANNEL_ID,
    redirect_uri: getCallbackUri(),
    state,
    scope: "profile openid email",
  });

  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

/** callback で state を検証 */
export function validateLineState(returnedState: string): boolean {
  const saved = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return Boolean(saved && saved === returnedState);
}

export type LineTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  id_token: string;
};

/**
 * authorization code を LINE token endpoint で交換する。
 * NOTE: client_secret が必要なため、本来はサーバーサイドで処理すべき。
 * Supabase Edge Function 経由で実行することを推奨。
 * ここでは VITE_LINE_CHANNEL_SECRET を使ったクライアントサイド実装を提供するが、
 * 本番では Edge Function に移行すること。
 */
export async function exchangeLineCode(code: string): Promise<LineTokenResponse> {
  const channelSecret = import.meta.env.VITE_LINE_CHANNEL_SECRET?.trim() ?? "";
  if (!channelSecret) {
    throw new Error("VITE_LINE_CHANNEL_SECRET が設定されていません");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getCallbackUri(),
    client_id: LINE_CHANNEL_ID,
    client_secret: channelSecret,
  });

  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE token exchange failed: ${text}`);
  }

  return res.json() as Promise<LineTokenResponse>;
}
