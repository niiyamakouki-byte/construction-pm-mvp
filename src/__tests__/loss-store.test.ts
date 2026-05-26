/**
 * Tests for LossStore.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { LossStore, getLossStore, _resetLossStore } from "../lib/cost-loss-detector/loss-store.js";
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
    detectedAt: new Date().toISOString(),
    evidenceRefs: [],
    lossYen: 10_000,
    message: "test",
    suggestedAction: "action",
    ...overrides,
  };
}

// ── Setup ──────────────────────────────────────────────────────────────────

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

// ── LossStore basic ────────────────────────────────────────────────────────

describe("LossStore", () => {
  it("初期状態で allSignals() は空配列", () => {
    const store = new LossStore();
    expect(store.allSignals()).toHaveLength(0);
  });

  it("recordSignals で signals が永続化される", () => {
    const store = new LossStore();
    const sig = makeSignal();
    store.recordSignals([sig]);
    expect(store.allSignals()).toHaveLength(1);
    expect(store.allSignals()[0].id).toBe(sig.id);
  });

  it("同 id のシグナルは重複追加されない", () => {
    const store = new LossStore();
    const sig = makeSignal({ id: "dup-1" });
    store.recordSignals([sig]);
    store.recordSignals([sig]);
    expect(store.allSignals()).toHaveLength(1);
  });

  it("signalsForProject — 対象 projectId のみ返す", () => {
    const store = new LossStore();
    store.recordSignals([
      makeSignal({ id: "s1", projectId: "p1" }),
      makeSignal({ id: "s2", projectId: "p2" }),
      makeSignal({ id: "s3", projectId: "p1" }),
    ]);
    const p1Sigs = store.signalsForProject("p1");
    expect(p1Sigs).toHaveLength(2);
    expect(p1Sigs.every((s) => s.projectId === "p1")).toBe(true);
  });

  it("clearByProject — 対象 projectId の signals を削除する", () => {
    const store = new LossStore();
    store.recordSignals([
      makeSignal({ id: "s1", projectId: "p1" }),
      makeSignal({ id: "s2", projectId: "p2" }),
    ]);
    store.clearByProject("p1");
    expect(store.signalsForProject("p1")).toHaveLength(0);
    expect(store.signalsForProject("p2")).toHaveLength(1);
  });

  it("markResolved — 指定 id の signal を削除する", () => {
    const store = new LossStore();
    store.recordSignals([
      makeSignal({ id: "to-resolve" }),
      makeSignal({ id: "keep" }),
    ]);
    store.markResolved("to-resolve");
    const all = store.allSignals();
    expect(all.find((s) => s.id === "to-resolve")).toBeUndefined();
    expect(all.find((s) => s.id === "keep")).toBeDefined();
  });

  it("markResolved — 存在しない id でもエラーにならない", () => {
    const store = new LossStore();
    expect(() => store.markResolved("nonexistent")).not.toThrow();
  });

  it("recordSignals([]) は何もしない", () => {
    const store = new LossStore();
    store.recordSignals([]);
    expect(store.allSignals()).toHaveLength(0);
  });
});

// ── EventTarget ────────────────────────────────────────────────────────────

describe("LossStore EventTarget", () => {
  it("recordSignals で 'change' イベントが発火する", () => {
    const store = new LossStore();
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.recordSignals([makeSignal()]);
    expect(fired).toBe(true);
  });

  it("clearByProject で 'change' イベントが発火する", () => {
    const store = new LossStore();
    store.recordSignals([makeSignal({ projectId: "px" })]);
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.clearByProject("px");
    expect(fired).toBe(true);
  });

  it("markResolved で 'change' イベントが発火する", () => {
    const store = new LossStore();
    store.recordSignals([makeSignal({ id: "resolve-me" })]);
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.markResolved("resolve-me");
    expect(fired).toBe(true);
  });
});

// ── Singleton ──────────────────────────────────────────────────────────────

describe("getLossStore singleton", () => {
  it("同じインスタンスを返す", () => {
    const a = getLossStore();
    const b = getLossStore();
    expect(a).toBe(b);
  });

  it("_resetLossStore で新インスタンスが返る", () => {
    const a = getLossStore();
    _resetLossStore();
    const b = getLossStore();
    expect(a).not.toBe(b);
  });
});

// ── FIFO cap ───────────────────────────────────────────────────────────────

describe("LossStore FIFO 5000件上限", () => {
  it("5001件追加後も allSignals が 5000件以下", () => {
    const store = new LossStore();
    const batch = Array.from({ length: 5001 }, (_, i) =>
      makeSignal({ id: `fifo-${i}` }),
    );
    store.recordSignals(batch);
    expect(store.allSignals().length).toBeLessThanOrEqual(5000);
  });
});
