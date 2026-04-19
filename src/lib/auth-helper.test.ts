import { describe, expect, it, vi } from "vitest";
import { verifyBearerAuth } from "./auth-helper.js";

type FakeResult = {
  data: { user: { id: string; email?: string } | null };
  error: { message: string } | null;
};

function makeAuth(impl: (token: string) => Promise<FakeResult>) {
  return {
    getUser: vi.fn(async (token: string) => impl(token)),
  };
}

describe("verifyBearerAuth", () => {
  it("Authorization ヘッダ欠落は 401 を返す", async () => {
    const auth = makeAuth(async () => ({
      data: { user: { id: "u1" } },
      error: null,
    }));
    const result = await verifyBearerAuth(auth, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it("Bearer 以外のスキームは 401", async () => {
    const auth = makeAuth(async () => ({
      data: { user: { id: "u1" } },
      error: null,
    }));
    const result = await verifyBearerAuth(auth, { authorization: "Basic abc" });
    expect(result.ok).toBe(false);
  });

  it("大文字小文字に関係なく Authorization を拾う", async () => {
    const auth = makeAuth(async () => ({
      data: { user: { id: "u1", email: "a@b.c" } },
      error: null,
    }));
    const result = await verifyBearerAuth(auth, {
      Authorization: "Bearer token-xyz",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("u1");
      expect(result.token).toBe("token-xyz");
    }
  });

  it("Supabase の error を 401 に変換する", async () => {
    const auth = makeAuth(async () => ({
      data: { user: null },
      error: { message: "invalid jwt" },
    }));
    const result = await verifyBearerAuth(auth, {
      authorization: "Bearer bad",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid jwt/);
  });

  it("user が null なら 401", async () => {
    const auth = makeAuth(async () => ({
      data: { user: null },
      error: null,
    }));
    const result = await verifyBearerAuth(auth, {
      authorization: "Bearer abc",
    });
    expect(result.ok).toBe(false);
  });

  it("getUser が throw したら 401", async () => {
    const auth = {
      getUser: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const result = await verifyBearerAuth(auth, {
      authorization: "Bearer abc",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/boom/);
  });
});
