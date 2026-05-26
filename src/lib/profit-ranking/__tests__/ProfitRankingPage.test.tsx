/**
 * Tests for ProfitRankingPage.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ProfitRankingPage } from "../../../components/ProfitRankingPage.js";
import { addProject, _resetProjectStore } from "../../store.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function makeProject(id: string, name: string, budget: number) {
  addProject({
    id,
    name,
    description: "テスト",
    status: "active",
    startDate: "2025-01-01",
    budget,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetProjectStore();
});

afterEach(() => {
  cleanup();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ProfitRankingPage", () => {
  it("ページタイトルが表示される", () => {
    render(<ProfitRankingPage />);
    expect(screen.getByText(/案件粗利ランキング/)).toBeTruthy();
  });

  it("案件なし → 案件データなしメッセージ表示", () => {
    render(<ProfitRankingPage />);
    expect(screen.getByText(/案件データがありません/)).toBeTruthy();
  });

  it("案件あり → 案件名がテーブルに表示される", () => {
    makeProject("p1", "渋谷リノベ", 10_000_000);
    render(<ProfitRankingPage />);
    expect(screen.getAllByText("渋谷リノベ").length).toBeGreaterThanOrEqual(1);
  });

  it("ソートボタンをクリックすると再レンダリングされる", () => {
    makeProject("p1", "青山内装", 8_000_000);
    render(<ProfitRankingPage />);
    const btn = screen.getByRole("button", { name: "粗利金額" });
    fireEvent.click(btn);
    // page still renders after sort change
    expect(screen.getAllByText("青山内装").length).toBeGreaterThanOrEqual(1);
  });

  it("KPI行: 平均粗利率が表示される", () => {
    makeProject("p1", "代官山案件", 5_000_000);
    render(<ProfitRankingPage />);
    expect(screen.getByText("平均粗利率")).toBeTruthy();
  });
});
