/**
 * Tests for CostLossDashboardPage.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { CostLossDashboardPage } from "../components/CostLossDashboardPage.js";
import { getLossStore, _resetLossStore } from "../lib/cost-loss-detector/loss-store.js";
import { LossKind } from "../lib/cost-loss-detector/types.js";
import type { LossSignal } from "../lib/cost-loss-detector/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

let _counter = 0;

function makeSignal(overrides: Partial<LossSignal> = {}): LossSignal {
  return {
    id: `sig-${++_counter}`,
    projectId: "p1",
    kind: LossKind.material_surplus,
    severity: "warning",
    detectedAt: "2025-06-01T10:00:00Z",
    evidenceRefs: [],
    lossYen: 50_000,
    message: "材料余剰テスト",
    suggestedAction: "返品交渉してください",
    ...overrides,
  };
}

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

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetLossStore();
});

afterEach(() => {
  cleanup();
});

// ── Rendering ──────────────────────────────────────────────────────────────

describe("CostLossDashboardPage", () => {
  it("ページタイトルが表示される", () => {
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    expect(screen.getByText("原価ロス検知")).toBeTruthy();
  });

  it("シグナルなし → 空状態メッセージを表示", () => {
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    expect(screen.getByText(/シグナルはありません/)).toBeTruthy();
  });

  it("シグナルあり → テーブルに表示される", () => {
    const store = getLossStore();
    store.recordSignals([makeSignal({ id: "s1" })]);
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    expect(screen.getByText("返品交渉してください")).toBeTruthy();
  });

  it("KPI: 推定ロス合計が表示される", () => {
    const store = getLossStore();
    store.recordSignals([makeSignal({ lossYen: 50_000 })]);
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    expect(screen.getByText("推定ロス合計")).toBeTruthy();
  });

  it("プロジェクトラベルが select に反映される", () => {
    render(
      <CostLossDashboardPage
        projectIds={["p1", "p2"]}
        projectLabels={{ p1: "南青山ビル", p2: "渋谷邸" }}
      />,
    );
    expect(screen.getByText("南青山ビル")).toBeTruthy();
    expect(screen.getByText("渋谷邸")).toBeTruthy();
  });

  it("「対応済」ボタンクリックでシグナルが消える", () => {
    const store = getLossStore();
    store.recordSignals([makeSignal({ id: "resolve-target" })]);
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    const btn = screen.getByRole("button", { name: "対応済" });
    fireEvent.click(btn);
    expect(store.signalsForProject("p1")).toHaveLength(0);
  });

  it("severity フィルタが機能する", () => {
    const store = getLossStore();
    store.recordSignals([
      makeSignal({ id: "s1", severity: "warning" }),
      makeSignal({ id: "s2", severity: "critical" }),
    ]);
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    const select = screen.getByRole("combobox", { name: "severity フィルタ" });
    fireEvent.change(select, { target: { value: "critical" } });
    // critical の suggestedAction は表示されるが warning は非表示になるはず
    // Both have same suggestedAction in fixture — check row count via buttons
    const buttons = screen.queryAllByRole("button", { name: "対応済" });
    expect(buttons).toHaveLength(1);
  });

  it("kind フィルタが機能する", () => {
    const store = getLossStore();
    store.recordSignals([
      makeSignal({ id: "s1", kind: LossKind.material_surplus }),
      makeSignal({ id: "s2", kind: LossKind.labor_overrun }),
    ]);
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    const select = screen.getByRole("combobox", { name: "kind フィルタ" });
    fireEvent.change(select, { target: { value: LossKind.labor_overrun } });
    const buttons = screen.queryAllByRole("button", { name: "対応済" });
    expect(buttons).toHaveLength(1);
  });

  it("案件選択 select が表示される", () => {
    render(<CostLossDashboardPage projectIds={["p1", "p2"]} />);
    expect(screen.getByRole("combobox", { name: "案件選択" })).toBeTruthy();
  });

  it("リセットボタンでフィルタがクリアされる", () => {
    const store = getLossStore();
    store.recordSignals([
      makeSignal({ id: "s1", severity: "warning" }),
      makeSignal({ id: "s2", severity: "critical" }),
    ]);
    render(<CostLossDashboardPage projectIds={["p1"]} />);
    const severitySelect = screen.getByRole("combobox", { name: "severity フィルタ" });
    fireEvent.change(severitySelect, { target: { value: "critical" } });
    const resetBtn = screen.getByRole("button", { name: "リセット" });
    fireEvent.click(resetBtn);
    // Both signals should be visible again
    const buttons = screen.queryAllByRole("button", { name: "対応済" });
    expect(buttons).toHaveLength(2);
  });
});
