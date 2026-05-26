/**
 * Tests for MarginWatcher.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { MarginWatcher } from "../margin-watcher.js";
import { MarginAlertStore, _resetMarginAlertStore } from "../margin-alert-store.js";
import type { ProjectFinanceSnapshot } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSnap(overrides: Partial<ProjectFinanceSnapshot> = {}): ProjectFinanceSnapshot {
  return {
    projectId: "p1",
    projectName: "テスト案件",
    contractAmountYen: 10_000_000,
    totalCostYen: 6_000_000,
    estimatedRemainingCostYen: 1_000_000,
    marginRatioPct: 40,
    forecastMarginRatioPct: 30,
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
  _resetMarginAlertStore();
});

// ── チャタリング抑制 ─────────────────────────────────────────────────────

describe("MarginWatcher - チャタリング抑制", () => {
  it("safe→safe の遷移では null を返す", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    // safe snapshot (forecast=30%)
    const safeSnap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 7_000_000, // forecast 30% = safe
    });

    // First call (prev=undefined, level=safe) → null
    const first = watcher.evaluate(safeSnap);
    expect(first).toBeNull();

    // Second call (prev=safe, level=safe) → null
    const second = watcher.evaluate(safeSnap);
    expect(second).toBeNull();
  });

  it("safe→warning の遷移ではアラートを返す", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    const safeSnap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 7_000_000, // 30% safe
    });
    const warnSnap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 8_000_000, // 20% warning
    });

    watcher.evaluate(safeSnap);
    const alert = watcher.evaluate(warnSnap);
    expect(alert).not.toBeNull();
    expect(alert?.level).toBe("warning");
  });

  it("critical 状態では常にアラートを返す (連続)", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    const critSnap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 9_000_000, // 10% critical
    });

    const first = watcher.evaluate(critSnap);
    const second = watcher.evaluate(critSnap);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
  });
});

// ── alert 生成確認 ─────────────────────────────────────────────────────────

describe("MarginWatcher - alert 生成", () => {
  it("warning レベルで正しい MarginAlert が生成される", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    const snap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 8_000_000, // forecast 20% warning
    });

    const alert = watcher.evaluate(snap);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe("warning");
    expect(alert!.projectId).toBe("p1");
    expect(alert!.projectName).toBe("テスト案件");
    expect(alert!.raisedAt).toBeTruthy();
    expect(typeof alert!.id).toBe("string");
  });

  it("store に alert が追加される", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    const snap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 8_000_000,
    });

    watcher.evaluate(snap);
    expect(store.all()).toHaveLength(1);
  });

  it("deltaFromTargetPct が正しく計算される (target=25)", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    // forecast = 20%, target = 25%, delta = -5
    const snap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 8_000_000,
    });

    const alert = watcher.evaluate(snap);
    expect(alert!.deltaFromTargetPct).toBeCloseTo(-5, 1);
  });
});

// ── snapshot 更新確認 ──────────────────────────────────────────────────────

describe("MarginWatcher - snapshot 更新", () => {
  it("evaluate 後に同プロジェクトの前回スナップを更新している", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    // critical snap
    const critSnap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 9_000_000, // 10% critical
    });

    watcher.evaluate(critSnap);

    // safe snap — now safe, but prev was critical so SHOULD generate alert
    const safeSnap = makeSnap({
      contractAmountYen: 10_000_000,
      totalCostYen: 0,
      estimatedRemainingCostYen: 7_000_000, // 30% safe
    });

    const alert = watcher.evaluate(safeSnap);
    // safe level but prev was critical → still generates alert (safe level but prev not safe)
    // Actually: safe level, prev was critical → level is safe, prevLevel is critical → NOT suppressed
    // The chatter suppression only applies when BOTH current and previous are safe
    expect(alert).not.toBeNull();
  });
});

// ── evaluateBatch ──────────────────────────────────────────────────────────

describe("MarginWatcher - evaluateBatch", () => {
  it("batch で複数 snapshot を一括評価", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);

    const snapshots: ProjectFinanceSnapshot[] = [
      makeSnap({
        projectId: "p1",
        contractAmountYen: 10_000_000,
        totalCostYen: 0,
        estimatedRemainingCostYen: 8_000_000, // 20% warning
      }),
      makeSnap({
        projectId: "p2",
        projectName: "案件2",
        contractAmountYen: 10_000_000,
        totalCostYen: 0,
        estimatedRemainingCostYen: 9_000_000, // 10% critical
      }),
      makeSnap({
        projectId: "p3",
        projectName: "案件3",
        contractAmountYen: 10_000_000,
        totalCostYen: 0,
        estimatedRemainingCostYen: 7_000_000, // 30% safe → null
      }),
    ];

    const alerts = watcher.evaluateBatch(snapshots);
    expect(alerts).toHaveLength(2);
    expect(alerts.some((a) => a.projectId === "p1")).toBe(true);
    expect(alerts.some((a) => a.projectId === "p2")).toBe(true);
    expect(alerts.every((a) => a.projectId !== "p3")).toBe(true);
  });

  it("空配列 → 空配列を返す", () => {
    const store = new MarginAlertStore();
    const watcher = new MarginWatcher(store);
    expect(watcher.evaluateBatch([])).toHaveLength(0);
  });
});
