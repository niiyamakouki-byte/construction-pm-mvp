/**
 * Tests for PortfolioStore.
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  PortfolioStore,
  getPortfolioStore,
  _resetPortfolioStore,
  type PortfolioChangeEvent,
} from "../lib/exec-dashboard/portfolio-store.js";
import type { Project } from "../domain/types.js";
import type { ProjectPortfolioEntry } from "../lib/exec-dashboard/portfolio-aggregator.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeProject(id: string): Project {
  return {
    id,
    name: `案件-${id}`,
    description: "",
    status: "active",
    startDate: "2025-01-01",
    budget: 5_000_000,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

function emptyEntry(project: Project): ProjectPortfolioEntry {
  return {
    project,
    tasks: [],
    invoices: [],
    chatMessages: [],
    photos: [],
    grossProfit: 500_000,
    contractAmount: 5_000_000,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PortfolioStore", () => {
  let store: PortfolioStore;

  beforeEach(() => {
    store = new PortfolioStore();
  });

  it("初期状態: summary が空サマリ", () => {
    const s = store.summary;
    expect(s.totalProjects).toBe(0);
    expect(s.totalGrossProfit).toBe(0);
    expect(s.dangerSignals).toHaveLength(0);
  });

  it("setEntries → summary を更新する", () => {
    const p1 = makeProject("p1");
    const p2 = makeProject("p2");
    store.setEntries([
      { ...emptyEntry(p1), grossProfit: 1_000_000 },
      { ...emptyEntry(p2), grossProfit: 2_000_000 },
    ]);
    expect(store.summary.totalProjects).toBe(2);
    expect(store.summary.totalGrossProfit).toBe(3_000_000);
  });

  it("setEntries → 'change' イベントを emit する", () => {
    const events: PortfolioChangeEvent[] = [];
    store.addEventListener("change", (e) => {
      events.push(e as PortfolioChangeEvent);
    });
    store.setEntries([emptyEntry(makeProject("p1"))]);
    expect(events).toHaveLength(1);
    expect(events[0].detail.totalProjects).toBe(1);
  });

  it("upsertEntry: 新規 → 追加される", () => {
    store.upsertEntry(emptyEntry(makeProject("p1")));
    expect(store.summary.totalProjects).toBe(1);
  });

  it("upsertEntry: 既存 → 上書きされる", () => {
    const p = makeProject("p1");
    store.upsertEntry({ ...emptyEntry(p), grossProfit: 100_000 });
    store.upsertEntry({ ...emptyEntry(p), grossProfit: 999_999 });
    expect(store.summary.totalProjects).toBe(1);
    expect(store.summary.totalGrossProfit).toBe(999_999);
  });

  it("upsertEntry → 'change' イベントを emit する", () => {
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.upsertEntry(emptyEntry(makeProject("p1")));
    expect(fired).toBe(true);
  });

  it("removeEntry → プロジェクトが削除される", () => {
    store.setEntries([
      emptyEntry(makeProject("p1")),
      emptyEntry(makeProject("p2")),
    ]);
    store.removeEntry("p1");
    expect(store.summary.totalProjects).toBe(1);
  });

  it("removeEntry → 'change' イベントを emit する", () => {
    store.setEntries([emptyEntry(makeProject("p1"))]);
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.removeEntry("p1");
    expect(fired).toBe(true);
  });

  it("removeEntry: 存在しない ID → エラーにならず totalProjects 変わらず", () => {
    store.setEntries([emptyEntry(makeProject("p1"))]);
    store.removeEntry("nonexistent");
    expect(store.summary.totalProjects).toBe(1);
  });
});

// ── Singleton ──────────────────────────────────────────────────────────────

describe("getPortfolioStore / _resetPortfolioStore", () => {
  beforeEach(() => {
    _resetPortfolioStore();
  });

  it("getPortfolioStore は常に同じインスタンスを返す", () => {
    const a = getPortfolioStore();
    const b = getPortfolioStore();
    expect(a).toBe(b);
  });

  it("_resetPortfolioStore 後は新しいインスタンスを返す", () => {
    const a = getPortfolioStore();
    _resetPortfolioStore();
    const b = getPortfolioStore();
    expect(a).not.toBe(b);
  });

  it("リセット後のストアは空サマリ", () => {
    const storeA = getPortfolioStore();
    storeA.setEntries([emptyEntry(makeProject("p1"))]);
    _resetPortfolioStore();
    const storeB = getPortfolioStore();
    expect(storeB.summary.totalProjects).toBe(0);
  });
});
