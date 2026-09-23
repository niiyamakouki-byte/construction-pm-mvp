import { describe, expect, it, vi } from "vitest";
import { linkProvider, providerLabel, unlinkProvider } from "./account-linking.js";
import type { AuthIdentity } from "../infra/supabase-client.js";

const email: AuthIdentity = { identity_id: "e1", id: "e", user_id: "u", provider: "email" };
const google: AuthIdentity = { identity_id: "g1", id: "g", user_id: "u", provider: "google" };

describe("account linking", () => {
  it("labels providers in Japanese UI terms", () => {
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("apple")).toBe("Apple");
    expect(providerLabel("email")).toBe("メール");
  });

  it("refuses to unlink the last identity", async () => {
    const result = await unlinkProvider({ unlinkIdentity: vi.fn() }, email, [email]);
    expect(result.errorMessage).toContain("最後のログイン方法");
  });

  it("links Apple with manual linking and returns to account settings", async () => {
    window.history.replaceState({}, "", "/#/account");
    const linkIdentity = vi.fn().mockResolvedValue({ data: { url: null }, error: null });
    const result = await linkProvider({ linkIdentity }, "apple");
    expect(result.errorMessage).toBeNull();
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: "http://localhost:3000/",
        scopes: "name email",
      },
    });
    expect(window.sessionStorage.getItem("genbahub_post_auth_route")).toBe("/account");
  });
});
