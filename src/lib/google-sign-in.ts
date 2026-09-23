import { getCapacitor, isCapacitorNative } from "./capacitor-runtime.js";
import { explainProviderAuthError, getOAuthRedirectUrl, rememberPostAuthRoute } from "./auth-redirect.js";

/** ログインと同時に工程表の予定ダブり表示へ使う読み取り専用スコープ。 */
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export type GoogleOAuthRequest = {
  provider: "google";
  options: {
    redirectTo: string;
    scopes: string;
    queryParams: { access_type: "offline"; prompt: "consent" };
    skipBrowserRedirect?: boolean;
  };
};

export type GoogleAuthClient = {
  signInWithOAuth(request: GoogleOAuthRequest): Promise<{
    data: { url?: string | null } | null;
    error: { message: string; code?: string } | null;
  }>;
};

/** Web は今のオリジン、Capacitor はカスタムスキーム + システムブラウザ。 */
export function buildGoogleOAuthRequest(): GoogleOAuthRequest {
  const native = isCapacitorNative();
  return {
    provider: "google",
    options: {
      redirectTo: getOAuthRedirectUrl(),
      scopes: GOOGLE_CALENDAR_SCOPE,
      queryParams: { access_type: "offline", prompt: "consent" },
      ...(native ? { skipBrowserRedirect: true } : {}),
    },
  };
}

export async function openNativeOAuthUrl(url: string | null | undefined): Promise<void> {
  if (!url || !isCapacitorNative()) return;
  const browser = getCapacitor()?.Plugins?.Browser;
  if (browser?.open) {
    await browser.open({ url });
    return;
  }
  window.location.assign(url);
}

export async function startGoogleOAuth(
  auth: GoogleAuthClient,
  options?: { postAuthRoute?: string },
): Promise<{ errorMessage: string | null }> {
  if (options?.postAuthRoute) {
    rememberPostAuthRoute(options.postAuthRoute);
  }
  const { data, error } = await auth.signInWithOAuth(buildGoogleOAuthRequest());
  if (error) {
    return { errorMessage: explainProviderAuthError(error) };
  }
  await openNativeOAuthUrl(data?.url ?? null);
  return { errorMessage: null };
}

export function currentPostAuthRoute(fallback = "/app"): string {
  if (typeof window === "undefined") return fallback;
  const hash = window.location.hash.replace(/^#/, "");
  const path = hash.split("?")[0];
  if (!path || path === "/" || path === "/login" || path === "/signup") return fallback;
  return path;
}
