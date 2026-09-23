import { afterEach, describe, expect, it } from "vitest";
import {
  CAPACITOR_ANDROID_ORIGIN,
  NATIVE_AUTH_CALLBACK,
  OAUTH_REDIRECT_ALLOW_LIST,
  PRODUCTION_WEB_ORIGIN,
  captureProviderRedirectError,
  consumePostAuthRoute,
  consumeProviderRedirectError,
  explainProviderAuthError,
  getOAuthRedirectUrl,
  rememberPostAuthRoute,
} from "./auth-redirect.js";

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/#/login");
});

describe("OAuth redirect allow list", () => {
  it("includes production web, local dev, Capacitor https localhost, and the Android scheme", () => {
    expect(OAUTH_REDIRECT_ALLOW_LIST).toContain(`${PRODUCTION_WEB_ORIGIN}/**`);
    expect(OAUTH_REDIRECT_ALLOW_LIST).toContain(`${CAPACITOR_ANDROID_ORIGIN}/**`);
    expect(OAUTH_REDIRECT_ALLOW_LIST).toContain(NATIVE_AUTH_CALLBACK);
    expect(OAUTH_REDIRECT_ALLOW_LIST).toEqual(
      expect.arrayContaining(["http://localhost:5173/**", "http://localhost:3000/**"]),
    );
  });

  it("keeps the PKCE redirect on the origin root for the hash router", () => {
    expect(getOAuthRedirectUrl()).toBe("http://localhost:3000/");
  });
});

describe("provider redirect errors", () => {
  it("stashes Google access_denied before the hash router moves away", () => {
    captureProviderRedirectError(
      "http://localhost:3000/?error=access_denied&error_description=The+user+cancelled",
    );
    expect(consumeProviderRedirectError()).toBe("ログインをキャンセルしました。");
    expect(consumeProviderRedirectError()).toBeNull();
  });

  it("explains redirect mismatches without showing the raw provider string", () => {
    expect(explainProviderAuthError({ message: "redirect_uri mismatch" })).toContain("戻り先 URL");
    expect(explainProviderAuthError({ message: "disallowed_useragent" })).toContain("Google");
  });
});

describe("post-auth route", () => {
  it("remembers and consumes a single route", () => {
    rememberPostAuthRoute("/account?from=google");
    expect(consumePostAuthRoute()).toBe("/account");
    expect(consumePostAuthRoute()).toBeNull();
  });
});
