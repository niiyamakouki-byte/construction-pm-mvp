import { isCapacitorNative } from "./capacitor-runtime.js";

/** 本番 Web。Supabase の Site URL もこのオリジンにする。 */
export const PRODUCTION_WEB_ORIGIN = "https://construction-pm-mvp.vercel.app";

/**
 * Capacitor `server.androidScheme: "https"` のときの WebView オリジン。
 * Google は WebView 内 OAuth を拒否するため、ネイティブの戻り先には使わない。
 * 許可リストには残す（プラグイン未導入時のフォールバックと、アプリ内表示の確認用）。
 */
export const CAPACITOR_ANDROID_ORIGIN = "https://localhost";

/** Chrome Custom Tab からアプリへ戻すカスタムスキーム。appId と揃える。 */
export const NATIVE_AUTH_CALLBACK = "jp.co.laporta.genbahub://auth/callback";

export const OAUTH_REDIRECT_ALLOW_LIST = [
  `${PRODUCTION_WEB_ORIGIN}/**`,
  `${PRODUCTION_WEB_ORIGIN}/`,
  "http://localhost:5173/**",
  "http://localhost:5173/",
  "http://localhost:3000/**",
  "http://localhost:3000/",
  `${CAPACITOR_ANDROID_ORIGIN}/**`,
  `${CAPACITOR_ANDROID_ORIGIN}/`,
  NATIVE_AUTH_CALLBACK,
] as const;

const PROVIDER_REDIRECT_ERROR_KEY = "genbahub_provider_redirect_error";
const POST_AUTH_ROUTE_KEY = "genbahub_post_auth_route";

function buildRedirectUrl(hash: string): string {
  if (typeof window === "undefined") {
    return hash;
  }

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = hash;
  return url.toString();
}

/** テストと本番の両方で同じ規則。ハッシュとクエリは PKCE の `code` と衝突するので捨てる。 */
export function oauthRedirectFromLocation(href: string, native: boolean): string {
  if (native) return NATIVE_AUTH_CALLBACK;
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  if (url.pathname === "/" || url.pathname === "") {
    return `${url.origin}/`;
  }
  return url.toString();
}

/**
 * OAuth / PKCE の戻り先。クエリに `code` が付くためハッシュは付けない。
 * ネイティブはカスタムスキーム。Web は今開いているオリジン（本番またはローカル）。
 */
export function getOAuthRedirectUrl(): string {
  if (typeof window === "undefined") {
    return `${PRODUCTION_WEB_ORIGIN}/`;
  }
  return oauthRedirectFromLocation(window.location.href, isCapacitorNative());
}

/**
 * マジックリンクはメールアプリが開く。Android のカスタムスキームはメールクライアントに
 * 依存するので、ネイティブでも本番 Web のルートへ戻し、アプリ内では 6 桁コードも受け付ける。
 */
export function getMagicLinkRedirectUrl(): string {
  if (typeof window === "undefined" || isCapacitorNative()) {
    return `${PRODUCTION_WEB_ORIGIN}/`;
  }
  return oauthRedirectFromLocation(window.location.href, false);
}

export function getPasswordRecoveryRedirectUrl(): string {
  if (isCapacitorNative()) {
    return `${PRODUCTION_WEB_ORIGIN}/#/account`;
  }
  return buildRedirectUrl("/account");
}

export function rememberPostAuthRoute(route: string): void {
  if (typeof window === "undefined") return;
  const path = route.startsWith("/") ? route : `/${route}`;
  try {
    window.sessionStorage.setItem(POST_AUTH_ROUTE_KEY, path.split("?")[0] || "/app");
  } catch {
    // sessionStorage が使えなくてもログイン自体は続行する
  }
}

export function consumePostAuthRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(POST_AUTH_ROUTE_KEY);
    if (value) window.sessionStorage.removeItem(POST_AUTH_ROUTE_KEY);
    return value;
  } catch {
    return null;
  }
}

export function explainProviderAuthError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (!msg.trim()) return "ログインに失敗しました。";
  if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) {
    return "このログイン方法はまだ有効になっていません。管理者に Supabase のプロバイダ設定を確認してもらってください。";
  }
  if (msg.includes("access_denied") || msg.includes("cancel")) {
    return "ログインをキャンセルしました。";
  }
  if (msg.includes("disallowed_useragent")) {
    return "この画面の中では Google ログインを完了できません。アプリを最新にして、ブラウザで開き直してください。";
  }
  if (msg.includes("redirect") && (msg.includes("not allowed") || msg.includes("invalid") || msg.includes("mismatch"))) {
    return "ログイン後の戻り先 URL が許可されていません。管理者にリダイレクト URL の設定を確認してもらってください。";
  }
  return "ログインに失敗しました。もう一度お試しください。";
}

/** 起動直後に呼ぶ。Supabase が URL を掃除する前にエラーを退避する。 */
export function captureProviderRedirectError(href?: string): void {
  if (typeof window === "undefined") return;
  let url: URL;
  try {
    url = new URL(href ?? window.location.href);
  } catch {
    return;
  }
  const code = url.searchParams.get("error");
  const description = url.searchParams.get("error_description");
  if (!code && !description) return;
  const message = explainProviderAuthError({
    code: code ?? undefined,
    message: description?.replace(/\+/g, " ") ?? code ?? undefined,
  });
  try {
    window.sessionStorage.setItem(PROVIDER_REDIRECT_ERROR_KEY, message);
  } catch {
    // ignore
  }
}

export function consumeProviderRedirectError(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(PROVIDER_REDIRECT_ERROR_KEY);
    if (value) window.sessionStorage.removeItem(PROVIDER_REDIRECT_ERROR_KEY);
    return value;
  } catch {
    return null;
  }
}
