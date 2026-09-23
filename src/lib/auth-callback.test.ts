import { afterEach, describe, expect, it, vi } from "vitest";
import {
  completeNativeOAuthCallback,
  extractAuthCode,
  listenForNativeOAuthCallback,
  resetConsumedAuthCodes,
} from "./auth-callback.js";
import { NATIVE_AUTH_CALLBACK } from "./auth-redirect.js";

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  resetConsumedAuthCodes();
});

describe("native OAuth callback", () => {
  it("extracts the PKCE code from the app scheme", () => {
    expect(extractAuthCode(`${NATIVE_AUTH_CALLBACK}?code=abc123`)).toBe("abc123");
    expect(extractAuthCode("https://construction-pm-mvp.vercel.app/?code=web")).toBe("web");
  });

  it("exchanges the code only for the native callback and closes the browser", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    (window as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      Plugins: { Browser: { close } },
    };
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });

    const ok = await completeNativeOAuthCallback(
      { auth: { exchangeCodeForSession } },
      `${NATIVE_AUTH_CALLBACK}?code=native-code`,
    );
    expect(ok).toBe(true);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("native-code");
    expect(close).toHaveBeenCalledOnce();

    const again = await completeNativeOAuthCallback(
      { auth: { exchangeCodeForSession } },
      `${NATIVE_AUTH_CALLBACK}?code=native-code`,
    );
    expect(again).toBe(false);
    expect(exchangeCodeForSession).toHaveBeenCalledOnce();
  });

  it("does not exchange a normal web URL from the desktop", async () => {
    const exchangeCodeForSession = vi.fn();
    const ok = await completeNativeOAuthCallback(
      { auth: { exchangeCodeForSession } },
      "http://localhost:3000/?code=desktop",
    );
    expect(ok).toBe(false);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("listens for the cold-start URL and later appUrlOpen events", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    const sink: { opened: (event: { url: string }) => void } = { opened: () => {} };
    const remove = vi.fn();
    (window as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        App: {
          getLaunchUrl: () => Promise.resolve({ url: `${NATIVE_AUTH_CALLBACK}?code=launch` }),
          addListener: (_event: string, cb: (event: { url: string }) => void) => {
            sink.opened = cb;
            return Promise.resolve({ remove });
          },
        },
        Browser: { close: vi.fn() },
      },
    };

    const stop = listenForNativeOAuthCallback({ auth: { exchangeCodeForSession } });
    await vi.waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith("launch");
    });
    sink.opened({ url: `${NATIVE_AUTH_CALLBACK}?code=resume` });
    await vi.waitFor(() => {
      expect(exchangeCodeForSession).toHaveBeenCalledWith("resume");
    });
    stop();
    expect(remove).toHaveBeenCalled();
  });
});
