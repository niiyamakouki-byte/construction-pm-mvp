/**
 * OwnerPortalSharePage.test.tsx
 *
 * Sprint 66 (2026-07-27, bd委譲): このページは /api/share-token（HMAC署名、サーバー専用鍵
 * SHARE_TOKEN_SECRET）経由で verifySignedToken を呼ぶ。以前は src/App.tsx から
 * ルーティングされておらず到達不能だったが、本委譲で /#/portal/share/:token に
 * 接続した。ここではその検証ゲートの主要な分岐（改ざん/期限切れ/パスワード要求/
 * 検証成功後のリダイレクト）を確認する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerPortalSharePage } from "../OwnerPortalSharePage.js";
import {
  createSignedShareToken,
  verifySignedShareToken,
} from "../../lib/share-token-handler.js";

const TEST_ENV: NodeJS.ProcessEnv = { SHARE_TOKEN_SECRET: "test-secret-do-not-use-in-prod" };

function mintToken(
  projectId: string,
  opts: { expiresInDays?: number; password?: string } = {},
): string {
  return createSignedShareToken(
    projectId,
    { expiresInDays: opts.expiresInDays ?? 30, password: opts.password },
    TEST_ENV,
  );
}

function stubVerifyFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as {
        action: string;
        token?: string;
        password?: string;
      };
      if (body.action !== "verify" || !body.token) {
        return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
      }
      const result = verifySignedShareToken(body.token, body.password, TEST_ENV);
      return new Response(JSON.stringify(result), { status: 200 });
    }),
  );
}

let redirectedTo = "";
let origLocation: Location;

beforeEach(() => {
  stubVerifyFetch();
  redirectedTo = "";
  origLocation = window.location;
  Object.defineProperty(window, "location", {
    value: {
      ...origLocation,
      origin: "http://localhost",
      pathname: "/",
      get href() {
        return redirectedTo || "http://localhost/";
      },
      set href(v: string) {
        redirectedTo = v;
      },
    },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  Object.defineProperty(window, "location", { value: origLocation, configurable: true });
});

describe("OwnerPortalSharePage", () => {
  it("shows tampered message for a malformed token", async () => {
    render(<OwnerPortalSharePage token="not-a-real-token" />);
    await waitFor(() => expect(screen.getByText("無効なリンクです")).toBeDefined());
  });

  it("shows expired message for an expired token", async () => {
    const token = mintToken("proj-x", { expiresInDays: -1 });
    render(<OwnerPortalSharePage token={token} />);
    await waitFor(() =>
      expect(screen.getByText("リンクの有効期限が切れました")).toBeDefined(),
    );
  });

  it("shows password form for a password-protected token, and redirects to /owner-app on correct password", async () => {
    const token = mintToken("proj-secure", { password: "genba123" });
    render(<OwnerPortalSharePage token={token} />);

    await waitFor(() => expect(screen.getByText("パスワードを入力")).toBeDefined());
    const input = screen.getByPlaceholderText("パスワード");
    fireEvent.change(input, { target: { value: "genba123" } });
    fireEvent.click(screen.getByRole("button", { name: "アクセスする" }));

    await waitFor(() => expect(redirectedTo).toContain("#/owner-app/proj-secure"));
    expect(redirectedTo).toContain(`token=${encodeURIComponent(token)}`);
  });

  it("redirects straight to /owner-app for a valid no-password token (this is the fix: verification is server-side, so this works cross-device)", async () => {
    const token = mintToken("proj-plain");
    render(<OwnerPortalSharePage token={token} />);

    await waitFor(() => expect(redirectedTo).toContain("#/owner-app/proj-plain"));
    expect(redirectedTo).toContain(`token=${encodeURIComponent(token)}`);
  });
});
