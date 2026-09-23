import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppleOAuthRequest, startAppleOAuth } from "./apple-sign-in.js";
import { NATIVE_AUTH_CALLBACK } from "./auth-redirect.js";

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  window.sessionStorage.clear();
});

describe("Apple sign-in", () => {
  it("uses the same PKCE redirect as Google on the web", () => {
    window.history.replaceState({}, "", "/#/login");
    expect(buildAppleOAuthRequest()).toEqual({
      provider: "apple",
      options: {
        redirectTo: "http://localhost:3000/",
        scopes: "name email",
      },
    });
  });

  it("opens the system browser on Capacitor", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    (window as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      Plugins: { Browser: { open } },
    };
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://appleid.apple.com/auth/authorize" },
      error: null,
    });
    const result = await startAppleOAuth({ signInWithOAuth });
    expect(result.errorMessage).toBeNull();
    expect(buildAppleOAuthRequest().options.redirectTo).toBe(NATIVE_AUTH_CALLBACK);
    expect(open).toHaveBeenCalledOnce();
  });
});
