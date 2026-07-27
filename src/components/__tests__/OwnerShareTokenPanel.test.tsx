/**
 * OwnerShareTokenPanel.test.tsx
 *
 * Sprint 66移行 (2026-07-27): 発行は /api/share-token（HMAC署名）経由になったため、
 * 旧localStorageベースの発行/一覧/無効化テストは新しいサーバー発行フローに合わせて
 * 書き換えた。永続一覧・無効化機能は廃止（署名トークンはステートレスなためサーバー側に
 * 一覧を持たない設計。詳細はOwnerShareTokenPanel.tsx冒頭コメント参照）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OwnerShareTokenPanel } from "../OwnerShareTokenPanel.js";
import {
  handleShareTokenRequest,
  type ShareTokenResponse,
} from "../../lib/share-token-handler.js";
import type { SupabaseAuthVerifier } from "../../lib/auth-helper.js";

const TEST_ENV: NodeJS.ProcessEnv = { SHARE_TOKEN_SECRET: "test-secret-do-not-use-in-prod" };

const testAuth: SupabaseAuthVerifier = {
  getUser: async (token: string) =>
    token === "valid-jwt"
      ? { data: { user: { id: "user-1" } }, error: null }
      : { data: { user: null }, error: { message: "invalid" } },
};

vi.mock("../../contexts/AuthContext.js", () => ({
  useAuth: () => ({ session: { access_token: "valid-jwt" } }),
}));

const mockProjects = [
  { id: "proj-alpha", name: "アルファ現場", status: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
  { id: "proj-beta", name: "ベータ現場", status: "active", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
];

vi.mock("../../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: vi.fn().mockResolvedValue(mockProjects),
    findById: vi.fn().mockResolvedValue(null),
  }),
}));

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const req = {
        method: "POST",
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        body: init.body,
      };
      let status = 200;
      let body: unknown = null;
      const res: ShareTokenResponse = {
        status(code) {
          status = code;
          return res;
        },
        json(b) {
          body = b;
          return res;
        },
        setHeader() {
          /* noop */
        },
      };
      await handleShareTokenRequest(req, res, { auth: testAuth, env: TEST_ENV });
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => {
  stubFetch();
  cleanup();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OwnerShareTokenPanel", () => {
  it("renders heading", async () => {
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("施主URL管理", {}, { timeout: 3000 });
    expect(screen.getByText("施主URL管理")).toBeDefined();
  });

  it("lists all projects", async () => {
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("アルファ現場", {}, { timeout: 3000 });
    expect(screen.getByText("アルファ現場")).toBeDefined();
    expect(screen.getByText("ベータ現場")).toBeDefined();
  });

  it("shows 共有リンクを発行 button for each project", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("共有リンクを発行", {}, { timeout: 3000 });
    expect(buttons.length).toBe(2);
  });

  it("shows issue form when 共有リンクを発行 is clicked", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("共有リンクを発行", {}, { timeout: 3000 });
    fireEvent.click(buttons[0]);
    // Should now display the issue form with 発行する button
    expect(screen.getByText("発行する")).toBeDefined();
  });

  it("associates the optional password label with the password field", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("共有リンクを発行", {}, { timeout: 3000 });
    fireEvent.click(buttons[0]);

    const passwordInput = screen.getByLabelText("パスワード（任意）") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
  });

  it("exposes the selected expiry option with aria-pressed", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("共有リンクを発行", {}, { timeout: 3000 });
    fireEvent.click(buttons[0]);

    const sevenDays = screen.getByRole("button", { name: "7日間" });
    const thirtyDays = screen.getByRole("button", { name: "30日間" });
    expect(thirtyDays.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(sevenDays);
    expect(sevenDays.getAttribute("aria-pressed")).toBe("true");
    expect(thirtyDays.getAttribute("aria-pressed")).toBe("false");
  });

  it("shows description text", async () => {
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("施主URL管理", {}, { timeout: 3000 });
    expect(screen.getByText(/施主専用ダッシュボードのアクセスURL/)).toBeDefined();
  });

  it("issuing a link calls the server API and displays a /portal/share/ URL with a copy button", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("共有リンクを発行", {}, { timeout: 3000 });
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByText("発行する"));

    await waitFor(() => expect(screen.getByText("コピー")).toBeDefined());
    const urlEl = screen.getByText(/#\/portal\/share\//);
    expect(urlEl.textContent).toContain("#/portal/share/");
  });

  it("shows an error message when the server rejects issuance (e.g. unauthenticated)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "認証が必要です" }), { status: 401 })),
    );
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("共有リンクを発行", {}, { timeout: 3000 });
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByText("発行する"));

    await waitFor(() => expect(screen.getByText("認証が必要です")).toBeDefined());
  });
});
