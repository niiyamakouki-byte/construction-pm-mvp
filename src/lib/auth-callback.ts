import { getCapacitor, isCapacitorNative } from "./capacitor-runtime.js";
import { NATIVE_AUTH_CALLBACK } from "./auth-redirect.js";

export type AuthCodeClient = {
  auth: {
    exchangeCodeForSession?: (authCode: string) => Promise<{
      data?: { session: unknown };
      error: { message: string } | null;
    }>;
  };
};

const consumedCodes = new Set<string>();

export function extractAuthCode(url: string): string | null {
  try {
    const code = new URL(url).searchParams.get("code");
    return code && code.length > 0 ? code : null;
  } catch {
    const match = url.match(/[?&]code=([^&#]+)/);
    if (!match?.[1]) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
}

export function isNativeAuthCallback(url: string): boolean {
  return url.startsWith(NATIVE_AUTH_CALLBACK) || url.startsWith("jp.co.laporta.genbahub://");
}

/** Capacitor の Custom Tab から戻った code を、今の WebView のセッションに交換する。 */
export async function completeNativeOAuthCallback(client: AuthCodeClient, url: string): Promise<boolean> {
  if (!isCapacitorNative() || !isNativeAuthCallback(url)) return false;
  const code = extractAuthCode(url);
  if (!code || consumedCodes.has(code)) return false;
  const exchange = client.auth.exchangeCodeForSession;
  if (!exchange) return false;
  consumedCodes.add(code);
  const result = await exchange(code);
  try {
    await getCapacitor()?.Plugins?.Browser?.close?.();
  } catch {
    // ブラウザを閉じられなくてもセッション交換の成否とは分ける
  }
  return !result?.error;
}

export function listenForNativeOAuthCallback(client: AuthCodeClient): () => void {
  const cap = getCapacitor();
  if (!cap?.isNativePlatform?.()) return () => {};
  const app = cap.Plugins?.App;
  if (!app?.addListener) return () => {};

  let disposed = false;
  let remove = () => {};

  const handleUrl = (url?: string) => {
    if (!url || disposed) return;
    void completeNativeOAuthCallback(client, url);
  };

  void Promise.resolve(app.getLaunchUrl?.()).then((launch) => {
    if (!disposed) handleUrl(launch?.url);
  });

  void Promise.resolve(
    app.addListener("appUrlOpen", (event) => {
      handleUrl(event.url);
    }),
  ).then((handle) => {
    if (disposed) {
      void handle.remove();
      return;
    }
    remove = () => {
      void handle.remove();
    };
  });

  return () => {
    disposed = true;
    remove();
  };
}

export function resetConsumedAuthCodes(): void {
  consumedCodes.clear();
}
