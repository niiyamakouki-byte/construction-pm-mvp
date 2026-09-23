import { afterEach, describe, expect, it, vi } from "vitest";
import { isPasskeyUiAvailable, registerDevicePasskey, signInWithDevicePasskey } from "./passkey-auth.js";

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
});

describe("passkey", () => {
  it("falls back when WebAuthn is missing", async () => {
    const result = await signInWithDevicePasskey({});
    expect(result.errorMessage).toContain("マジックリンク");
    expect(isPasskeyUiAvailable()).toBe(false);
  });

  it("calls Supabase signInWithPasskey on a supporting browser", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = class {};
    const signInWithPasskey = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    const result = await signInWithDevicePasskey({ signInWithPasskey });
    expect(result.errorMessage).toBeNull();
    expect(signInWithPasskey).toHaveBeenCalledOnce();
  });

  it("does not start a ceremony inside the Capacitor localhost shell", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = class {};
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    const signInWithPasskey = vi.fn();
    const result = await signInWithDevicePasskey({ signInWithPasskey });
    expect(signInWithPasskey).not.toHaveBeenCalled();
    expect(result.errorMessage).toContain("アプリ内");
  });

  it("registers a passkey for the signed-in user", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = class {};
    const registerPasskey = vi.fn().mockResolvedValue({
      data: { id: "pk", friendly_name: "Chrome" },
      error: null,
    });
    const result = await registerDevicePasskey({ registerPasskey });
    expect(result).toEqual({ errorMessage: null, friendlyName: "Chrome" });
  });

  it("explains a disabled passkey provider", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = class {};
    const result = await signInWithDevicePasskey({
      signInWithPasskey: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { message: "passkey_disabled", code: "passkey_disabled" },
      }),
    });
    expect(result.errorMessage).toContain("まだ有効になっていません");
  });
});
