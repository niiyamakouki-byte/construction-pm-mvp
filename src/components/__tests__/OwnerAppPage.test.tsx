/**
 * OwnerAppPage.test.tsx
 *
 * Sprint 66移行 (2026-07-27): トークン検証が /api/share-token（HMAC署名）経由の
 * verifySignedToken に変わったため、旧owner-app/share-token.js(localStorage)ベースの
 * テストは署名トークン生成(createSignedShareToken)+fetchスタブに書き換えた。
 * 署名スキームにrevoke機能は無いため「無効化されたリンク」テストは
 * 「改ざんされた署名」テストに置き換えている。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { OwnerAppPage } from "../OwnerAppPage.js";
import {
  createSignedShareToken,
  verifySignedShareToken,
} from "../../lib/share-token-handler.js";
import { ownerStore } from "../../lib/owner-app/owner-store.js";

const TEST_ENV: NodeJS.ProcessEnv = { SHARE_TOKEN_SECRET: "test-secret-do-not-use-in-prod" };

function mintToken(projectId: string, expiresInDays = 30): string {
  return createSignedShareToken(projectId, { expiresInDays }, TEST_ENV);
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

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Mock buildOwnerSnapshot to avoid async complexity in component tests
vi.mock("../../lib/owner-app/snapshot-builder.js", () => ({
  buildOwnerSnapshot: vi.fn().mockResolvedValue({
    projectId: "proj-test",
    projectName: "テスト現場",
    overallProgress: 45,
    currentPhase: "内装工事",
    todaysPhotos: ["http://example.com/photo1.jpg"],
    recentMessages: [
      { id: "m1", sender: "pm", text: "本日の工事は順調です", ts: "2026-01-01T10:00:00" },
    ],
    pendingRequests: [],
    paymentMilestones: [],
  }),
}));

// Mock createProjectRepository
vi.mock("../../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findById: vi.fn().mockResolvedValue({ id: "proj-test", name: "テスト現場" }),
    findAll: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock createPhotoStore
vi.mock("../../stores/photo-store.js", () => ({
  createPhotoStore: () => ({
    listPhotosByProject: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock project-tasks-store
vi.mock("../../lib/project-tasks-store.js", () => ({
  fetchProjectTasks: vi.fn().mockResolvedValue([]),
}));

beforeEach(() => {
  localStorage.clear();
  ownerStore._reset();
  stubVerifyFetch();
  cleanup();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("OwnerAppPage — token validation", () => {
  it("shows invalid-link detail for unknown token", async () => {
    const { findByText } = render(<OwnerAppPage projectId="proj-test" token="bad-token" />);
    await findByText("リンクが正しくありません", {}, { timeout: 3000 });
  });

  it("shows invalid-link detail for a tampered signature (no revoke concept in signed scheme)", async () => {
    const token = mintToken("proj-test");
    const tampered = token.slice(0, -4) + "XXXX";
    const { findByText } = render(<OwnerAppPage projectId="proj-test" token={tampered} />);
    await findByText("リンクが正しくありません", {}, { timeout: 3000 });
  });

  it("shows expired detail for expired token", async () => {
    const token = mintToken("proj-test", -1);
    const { findByText } = render(<OwnerAppPage projectId="proj-test" token={token} />);
    await findByText("リンクの有効期限が切れています", {}, { timeout: 3000 });
  });

  it("shows project mismatch detail for wrong project", async () => {
    const token = mintToken("other-proj");
    const { findByText } = render(<OwnerAppPage projectId="proj-test" token={token} />);
    await findByText("リンクと案件が一致しません", {}, { timeout: 3000 });
  });

  it("shows loading then dashboard for valid token", () => {
    const token = mintToken("proj-test");
    render(<OwnerAppPage projectId="proj-test" token={token} />);
    // Initial render shows loading (verification is async)
    expect(screen.queryByText("アクセスできません")).toBeNull();
  });

  it("verifies successfully even when localStorage is empty (cross-device: no client-side secret dependency)", async () => {
    const token = mintToken("proj-test");
    localStorage.clear();
    const { findByText } = render(<OwnerAppPage projectId="proj-test" token={token} />);
    await findByText("テスト現場", {}, { timeout: 3000 });
  });
});

describe("OwnerAppPage — snapshot display", () => {
  async function renderWithValidToken() {
    const token = mintToken("proj-test");
    const { findByText } = render(
      <OwnerAppPage projectId="proj-test" token={token} />,
    );
    // Wait for async load
    await findByText("テスト現場", {}, { timeout: 3000 });
    return { findByText };
  }

  it("displays project name in header", async () => {
    await renderWithValidToken();
    expect(screen.getByText("テスト現場")).toBeDefined();
  });

  it("displays progress percentage", async () => {
    await renderWithValidToken();
    expect(screen.getByText("45%")).toBeDefined();
  });

  it("displays current phase", async () => {
    await renderWithValidToken();
    expect(screen.getByText(/内装工事/)).toBeDefined();
  });

  it("displays PM chat message", async () => {
    await renderWithValidToken();
    expect(screen.getByText("本日の工事は順調です")).toBeDefined();
  });

  it("displays 変更要望 section", async () => {
    await renderWithValidToken();
    expect(screen.getByText("変更要望")).toBeDefined();
  });

  it("displays 新規要望 button", async () => {
    await renderWithValidToken();
    expect(screen.getByText("+ 新規要望")).toBeDefined();
  });

  it("displays 施主ダッシュボード label", async () => {
    await renderWithValidToken();
    expect(screen.getByText("施主ダッシュボード")).toBeDefined();
  });
});

describe("OwnerAppPage — chat", () => {
  it("shows チャット heading", async () => {
    const token = mintToken("proj-test");
    const { findByText } = render(
      <OwnerAppPage projectId="proj-test" token={token} />,
    );
    await findByText("テスト現場", {}, { timeout: 3000 });
    expect(screen.getByText("チャット")).toBeDefined();
  });

  it("has a send button", async () => {
    const token = mintToken("proj-test");
    const { findByText } = render(
      <OwnerAppPage projectId="proj-test" token={token} />,
    );
    await findByText("テスト現場", {}, { timeout: 3000 });
    expect(screen.getByText("送信")).toBeDefined();
  });
});

describe("OwnerAppPage — change request modal", () => {
  async function openModal() {
    const token = mintToken("proj-test");
    const { findByText } = render(
      <OwnerAppPage projectId="proj-test" token={token} />,
    );
    await findByText("テスト現場", {}, { timeout: 3000 });
    const btn = screen.getByText("+ 新規要望");
    fireEvent.click(btn);
    return { findByText };
  }

  it("opens modal with タイトル field", async () => {
    await openModal();
    expect(screen.getByText("変更要望を提出")).toBeDefined();
    expect(screen.getByPlaceholderText("例: 床材の変更希望")).toBeDefined();
  });

  it("closes modal on キャンセル", async () => {
    await openModal();
    const cancel = screen.getByText("キャンセル");
    fireEvent.click(cancel);
    expect(screen.queryByText("変更要望を提出")).toBeNull();
  });

  it("submits request and closes modal", async () => {
    await openModal();
    const input = screen.getByPlaceholderText("例: 床材の変更希望");
    fireEvent.change(input, { target: { value: "床材変更希望" } });
    fireEvent.click(screen.getByText("提出"));
    expect(screen.queryByText("変更要望を提出")).toBeNull();
  });
});
