/**
 * Tests for CrewOptimizerPage.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CrewOptimizerPage } from "../../../components/CrewOptimizerPage.js";
import { _resetCraftsmanStore } from "../craftsman-store.js";
import { _resetTaskAssignmentStore } from "../task-store.js";
import { _resetCrewOptimizationStore } from "../optimization-store.js";

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetCraftsmanStore();
  _resetTaskAssignmentStore();
  _resetCrewOptimizationStore();
});

afterEach(() => {
  cleanup();
});

describe("CrewOptimizerPage", () => {
  it("ページタイトルが表示される", () => {
    render(<CrewOptimizerPage />);
    expect(screen.getByText(/職人スケジュール最適化/)).toBeTruthy();
  });

  it("KPI 4枚が表示される", () => {
    render(<CrewOptimizerPage />);
    const kpiSection = screen.getByTestId("kpi-section");
    expect(kpiSection).toBeTruthy();
    // 職人数 / 今日のタスク数 / コンフリクト数 / 平均稼働率
    expect(screen.getByText("職人数")).toBeTruthy();
    expect(screen.getByText("今日のタスク数")).toBeTruthy();
    expect(screen.getByText("コンフリクト数")).toBeTruthy();
    expect(screen.getByText("平均稼働率")).toBeTruthy();
  });

  it("最適化ボタンが表示される", () => {
    render(<CrewOptimizerPage />);
    const btn = screen.getByTestId("optimize-btn");
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain("最適化を実行");
  });

  it("最適化ボタン押下 → スケジュールセクションが出現する (seed データあり)", () => {
    render(<CrewOptimizerPage />);
    const btn = screen.getByTestId("optimize-btn");
    fireEvent.click(btn);
    // After optimization, schedule table should appear
    expect(screen.getByTestId("schedule-section")).toBeTruthy();
  });

  it("最適化ボタン押下 → コンフリクトカウントが数値で表示される", () => {
    render(<CrewOptimizerPage />);
    const btn = screen.getByTestId("optimize-btn");
    fireEvent.click(btn);
    // KPI コンフリクト数が表示される
    const conflictKpi = screen.getByTestId("kpi-コンフリクト数");
    expect(conflictKpi).toBeTruthy();
    // value should be a number string
    expect(Number(conflictKpi.textContent)).toBeGreaterThanOrEqual(0);
  });
});
