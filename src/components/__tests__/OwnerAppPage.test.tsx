/**
 * OwnerAppPage.test.tsx
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { OwnerAppPage } from "../OwnerAppPage.js";
import { generateShareToken, revokeShareToken } from "../../lib/owner-app/share-token.js";
import { ownerStore } from "../../lib/owner-app/owner-store.js";

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
  cleanup();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("OwnerAppPage — token validation", () => {
  it("shows invalid-link detail for unknown token", () => {
    render(<OwnerAppPage projectId="proj-test" token="bad-token" />);
    expect(screen.getByText("リンクが正しくありません")).toBeDefined();
  });

  it("shows expired detail for expired token", () => {
    const token = generateShareToken("proj-test", -1);
    render(<OwnerAppPage projectId="proj-test" token={token} />);
    expect(screen.getByText("リンクの有効期限が切れています")).toBeDefined();
  });

  it("shows revoked detail for revoked token", () => {
    const token = generateShareToken("proj-test");
    revokeShareToken(token);
    render(<OwnerAppPage projectId="proj-test" token={token} />);
    expect(screen.getByText("このリンクは無効化されています")).toBeDefined();
  });

  it("shows project mismatch detail for wrong project", () => {
    const token = generateShareToken("other-proj");
    render(<OwnerAppPage projectId="proj-test" token={token} />);
    expect(screen.getByText("リンクと案件が一致しません")).toBeDefined();
  });

  it("shows loading then dashboard for valid token", async () => {
    const token = generateShareToken("proj-test");
    render(<OwnerAppPage projectId="proj-test" token={token} />);
    // Initial render shows loading
    expect(screen.queryByText("アクセスできません")).toBeNull();
  });
});

describe("OwnerAppPage — snapshot display", () => {
  async function renderWithValidToken() {
    const token = generateShareToken("proj-test");
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
    const token = generateShareToken("proj-test");
    const { findByText } = render(
      <OwnerAppPage projectId="proj-test" token={token} />,
    );
    await findByText("テスト現場", {}, { timeout: 3000 });
    expect(screen.getByText("チャット")).toBeDefined();
  });

  it("has a send button", async () => {
    const token = generateShareToken("proj-test");
    const { findByText } = render(
      <OwnerAppPage projectId="proj-test" token={token} />,
    );
    await findByText("テスト現場", {}, { timeout: 3000 });
    expect(screen.getByText("送信")).toBeDefined();
  });
});

describe("OwnerAppPage — change request modal", () => {
  async function openModal() {
    const token = generateShareToken("proj-test");
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
