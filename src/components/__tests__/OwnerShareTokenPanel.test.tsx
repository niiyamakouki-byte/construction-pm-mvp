/**
 * OwnerShareTokenPanel.test.tsx
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { OwnerShareTokenPanel } from "../OwnerShareTokenPanel.js";
import { generateShareToken, revokeShareToken } from "../../lib/owner-app/share-token.js";

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

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
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

  it("shows 施主用URL生成 button for each project", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("施主用URL生成", {}, { timeout: 3000 });
    expect(buttons.length).toBe(2);
  });

  it("generates and displays a URL when button clicked", async () => {
    const { findAllByText } = render(<OwnerShareTokenPanel />);
    const buttons = await findAllByText("施主用URL生成", {}, { timeout: 3000 });
    fireEvent.click(buttons[0]);
    // Should now display a copy button
    expect(screen.getAllByText("コピー").length).toBeGreaterThanOrEqual(1);
  });

  it("shows existing tokens on mount", async () => {
    generateShareToken("proj-alpha", 30);
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("アルファ現場", {}, { timeout: 3000 });
    expect(screen.getByText("コピー")).toBeDefined();
  });

  it("shows 無効 badge for revoked token", async () => {
    const token = generateShareToken("proj-alpha", 30);
    revokeShareToken(token);
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("アルファ現場", {}, { timeout: 3000 });
    expect(screen.getByText("無効")).toBeDefined();
  });

  it("shows 無効化 button for active token", async () => {
    generateShareToken("proj-alpha", 30);
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("アルファ現場", {}, { timeout: 3000 });
    expect(screen.getByText("無効化")).toBeDefined();
  });

  it("revoking a token updates display to 無効", async () => {
    generateShareToken("proj-alpha", 30);
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("アルファ現場", {}, { timeout: 3000 });
    const revokeBtn = screen.getByText("無効化");
    fireEvent.click(revokeBtn);
    expect(screen.getByText("無効")).toBeDefined();
    expect(screen.queryByText("無効化")).toBeNull();
  });

  it("shows description text", async () => {
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("施主URL管理", {}, { timeout: 3000 });
    expect(screen.getByText(/施主専用ダッシュボードのアクセスURL/)).toBeDefined();
  });

  it("shows 期限切れ badge for expired token", async () => {
    generateShareToken("proj-beta", -1); // expired
    const { findByText } = render(<OwnerShareTokenPanel />);
    await findByText("ベータ現場", {}, { timeout: 3000 });
    expect(screen.getByText("期限切れ")).toBeDefined();
  });
});
