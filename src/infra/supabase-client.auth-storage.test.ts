import { afterEach, describe, expect, it } from "vitest";
import { prefersPersistentAuthStorage, setRememberLoginPreference } from "./supabase-client.js";

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("prefersPersistentAuthStorage", () => {
  it("follows the remember checkbox on the desktop", () => {
    setRememberLoginPreference(false);
    expect(prefersPersistentAuthStorage()).toBe(false);
    setRememberLoginPreference(true);
    expect(prefersPersistentAuthStorage()).toBe(true);
  });

  it("keeps the session in localStorage inside the Capacitor WebView", () => {
    setRememberLoginPreference(false);
    window.sessionStorage.setItem("genbahub_auth_token", "native-session");
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    setRememberLoginPreference(false);
    expect(prefersPersistentAuthStorage()).toBe(true);
    expect(window.localStorage.getItem("genbahub_auth_token")).toBe("native-session");
    expect(window.sessionStorage.getItem("genbahub_auth_token")).toBeNull();
  });
});
