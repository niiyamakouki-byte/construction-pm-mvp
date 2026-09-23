import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGoogleOAuthRequest, openNativeOAuthUrl, startGoogleOAuth } from "./google-sign-in.js";
import { NATIVE_AUTH_CALLBACK, PRODUCTION_WEB_ORIGIN, oauthRedirectFromLocation } from "./auth-redirect.js";

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("buildGoogleOAuthRequest", () => {
  it("uses the current web origin and calendar scope for desktop", () => {
    window.history.replaceState({}, "", "/#/login");
    expect(buildGoogleOAuthRequest()).toEqual({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/",
        scopes: "https://www.googleapis.com/auth/calendar.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  });

  it("uses the production origin when the app is served from Vercel", () => {
    expect(oauthRedirectFromLocation(`${PRODUCTION_WEB_ORIGIN}/#/login`, false)).toBe(`${PRODUCTION_WEB_ORIGIN}/`);
    expect(oauthRedirectFromLocation(`${PRODUCTION_WEB_ORIGIN}/?code=old#/login`, false)).toBe(`${PRODUCTION_WEB_ORIGIN}/`);
  });

  it("returns the Capacitor custom scheme and skips the WebView redirect", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    (window as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => "android",
      Plugins: { Browser: { open } },
    };

    const request = buildGoogleOAuthRequest();
    expect(request.options.redirectTo).toBe(NATIVE_AUTH_CALLBACK);
    expect(request.options.skipBrowserRedirect).toBe(true);

    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/auth?client_id=test" },
      error: null,
    });
    const result = await startGoogleOAuth({ signInWithOAuth }, { postAuthRoute: "/account" });
    expect(result.errorMessage).toBeNull();
    expect(open).toHaveBeenCalledWith({ url: "https://accounts.google.com/o/oauth2/auth?client_id=test" });
    expect(window.sessionStorage.getItem("genbahub_post_auth_route")).toBe("/account");
  });

  it("maps a disabled Google provider to Japanese", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Unsupported provider: provider is not enabled" },
    });
    const result = await startGoogleOAuth({ signInWithOAuth });
    expect(result.errorMessage).toContain("まだ有効になっていません");
  });

  it("does not leave the desktop page when there is no Capacitor shell", async () => {
    await expect(openNativeOAuthUrl("https://accounts.google.com/o/oauth2/auth")).resolves.toBeUndefined();
  });
});
