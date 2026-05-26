/**
 * Tests for PredictionStore (delay-predictor)
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  PredictionStore,
  getPredictionStore,
  _resetPredictionStore,
} from "../../lib/delay-predictor/prediction-store.js";
import type { DelayPrediction } from "../../lib/delay-predictor/types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

let _counter = 0;

function makePrediction(overrides: Partial<DelayPrediction> = {}): DelayPrediction {
  const n = ++_counter;
  return {
    taskId: `task-${n}`,
    projectId: "project-1",
    riskPct: 25,
    riskLevel: "low",
    factors: { weatherRisk: 10, laborRisk: 0, kindBaselineRisk: 40 },
    suggestedAction_ja: "予定通り進行可",
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
  _resetPredictionStore();
});

// ── save / allPredictions ─────────────────────────────────────────────────

describe("PredictionStore save", () => {
  it("save で予測結果が保存される", () => {
    const store = new PredictionStore();
    const p = makePrediction();
    store.save(p);
    expect(store.allPredictions()).toHaveLength(1);
  });

  it("同 taskId + projectId の場合は上書きされる", () => {
    const store = new PredictionStore();
    const p = makePrediction({ taskId: "dup" });
    store.save(p);
    store.save({ ...p, riskPct: 80 });
    expect(store.allPredictions()).toHaveLength(1);
    expect(store.allPredictions()[0].riskPct).toBe(80);
  });

  it("save で 'change' イベントが発火する", () => {
    const store = new PredictionStore();
    let fired = false;
    store.addEventListener("change", () => { fired = true; });
    store.save(makePrediction());
    expect(fired).toBe(true);
  });
});

// ── queryByProject ────────────────────────────────────────────────────────

describe("PredictionStore queryByProject", () => {
  it("指定 projectId のみ返す", () => {
    const store = new PredictionStore();
    store.save(makePrediction({ projectId: "p1" }));
    store.save(makePrediction({ projectId: "p2" }));
    store.save(makePrediction({ projectId: "p1" }));
    expect(store.queryByProject("p1")).toHaveLength(2);
    expect(store.queryByProject("p2")).toHaveLength(1);
  });

  it("存在しない projectId は空配列", () => {
    const store = new PredictionStore();
    expect(store.queryByProject("no-such")).toHaveLength(0);
  });
});

// ── queryByRiskLevel ──────────────────────────────────────────────────────

describe("PredictionStore queryByRiskLevel", () => {
  it("指定 riskLevel のみ返す", () => {
    const store = new PredictionStore();
    store.save(makePrediction({ riskLevel: "critical" }));
    store.save(makePrediction({ riskLevel: "low" }));
    store.save(makePrediction({ riskLevel: "critical" }));
    expect(store.queryByRiskLevel("critical")).toHaveLength(2);
    expect(store.queryByRiskLevel("low")).toHaveLength(1);
  });
});

// ── removeByTask ──────────────────────────────────────────────────────────

describe("PredictionStore removeByTask", () => {
  it("指定 taskId の予測を削除する", () => {
    const store = new PredictionStore();
    store.save(makePrediction({ taskId: "to-remove" }));
    store.save(makePrediction({ taskId: "keep" }));
    store.removeByTask("to-remove");
    expect(store.allPredictions().find((p) => p.taskId === "to-remove")).toBeUndefined();
    expect(store.allPredictions().find((p) => p.taskId === "keep")).toBeDefined();
  });

  it("存在しない taskId でも例外にならない", () => {
    const store = new PredictionStore();
    expect(() => store.removeByTask("ghost")).not.toThrow();
  });
});

// ── Singleton ─────────────────────────────────────────────────────────────

describe("getPredictionStore singleton", () => {
  it("同じインスタンスを返す", () => {
    const a = getPredictionStore();
    const b = getPredictionStore();
    expect(a).toBe(b);
  });

  it("_resetPredictionStore で新インスタンスが返る", () => {
    const a = getPredictionStore();
    _resetPredictionStore();
    const b = getPredictionStore();
    expect(a).not.toBe(b);
  });
});

// ── FIFO 5000件上限 ───────────────────────────────────────────────────────

describe("PredictionStore FIFO 5000件上限", () => {
  it("5001件保存後も allPredictions が 5000件以下", () => {
    const store = new PredictionStore();
    const batch = Array.from({ length: 5001 }, (_, i) =>
      makePrediction({ taskId: `fifo-${i}`, projectId: "px" }),
    );
    store.saveAll(batch);
    expect(store.allPredictions().length).toBeLessThanOrEqual(5000);
  });
});
