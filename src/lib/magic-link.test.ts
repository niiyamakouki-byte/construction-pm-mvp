import { describe, expect, it, vi } from "vitest";
import { buildMagicLinkRequest, sendMagicLink, verifyMagicLinkCode } from "./magic-link.js";
import { PRODUCTION_WEB_ORIGIN } from "./auth-redirect.js";

describe("magic link", () => {
  it("sends the passwordless email back to the current origin", () => {
    window.history.replaceState({}, "", "/#/login");
    expect(buildMagicLinkRequest(" user@example.com ")).toEqual({
      email: "user@example.com",
      options: {
        emailRedirectTo: "http://localhost:3000/",
        shouldCreateUser: true,
      },
    });
  });

  it("uses the production site when the mail app opens from the Android shell", () => {
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(buildMagicLinkRequest("user@example.com").options.emailRedirectTo).toBe(`${PRODUCTION_WEB_ORIGIN}/`);
    delete (window as { Capacitor?: unknown }).Capacitor;
  });

  it("verifies a 6-digit code into the current session", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ data: { session: {} }, error: null });
    const result = await verifyMagicLinkCode(
      { signInWithOtp: vi.fn(), verifyOtp },
      "user@example.com",
      "123456",
    );
    expect(result.errorMessage).toBeNull();
    expect(verifyOtp).toHaveBeenCalledWith({ email: "user@example.com", token: "123456", type: "email" });
  });

  it("maps an expired code to Japanese", async () => {
    const result = await sendMagicLink(
      {
        signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: { message: "provider is not enabled" } }),
      },
      "user@example.com",
    );
    expect(result.errorMessage).toContain("まだ有効になっていません");
  });
});
