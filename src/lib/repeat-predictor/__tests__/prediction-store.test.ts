/**
 * Tests for prediction-store.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { PredictionStore, _resetPredictionStore } from "../prediction-store.js";
import type { RepeatPrediction } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

// ── Fixture ────────────────────────────────────────────────────────────────

function makePrediction(customerId: string, probability = 0.7): RepeatPrediction {
  return {
    customerId,
    segment: "loyal",
    repeatProbability: probability,
    predictedNextOrderMonths: 3,
    confidenceLevel: "med",
    reasoning_ja: "テスト",
    recommendedAction_ja: "テストアクション",
    scoreBreakdown: {
      recencyScore: 0.8,
      frequencyScore: 0.5,
      monetaryScore: 0.5,
      satisfactionScore: 0.8,
      referralScore: 0.0,
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PredictionStore — 基本 CRUD", () => {
  let s: PredictionStore;

  beforeEach(() => {
    localStorage.clear();
    _resetPredictionStore();
    s = new PredictionStore();
  });

  it("初期状態は空", () => {
    expect(s.all()).toHaveLength(0);
  });

  it("upsert で追加される", () => {
    s.upsert(makePrediction("c001"));
    expect(s.all()).toHaveLength(1);
  });

  it("同じ customerId で upsert すると上書き", () => {
    s.upsert(makePrediction("c001", 0.5));
    s.upsert(makePrediction("c001", 0.9));
    expect(s.all()).toHaveLength(1);
    expect(s.byCustomer("c001")?.repeatProbability).toBe(0.9);
  });

  it("byCustomer で特定顧客の予測が返る", () => {
    s.upsert(makePrediction("c001"));
    s.upsert(makePrediction("c002"));
    expect(s.byCustomer("c001")).not.toBeNull();
    expect(s.byCustomer("c999")).toBeNull();
  });

  it("upsertAll で複数まとめて追加", () => {
    s.upsertAll([makePrediction("c001"), makePrediction("c002"), makePrediction("c003")]);
    expect(s.all()).toHaveLength(3);
  });

  it("clear で全件削除", () => {
    s.upsert(makePrediction("c001"));
    s.upsert(makePrediction("c002"));
    s.clear();
    expect(s.all()).toHaveLength(0);
  });
});

describe("PredictionStore — bySegment", () => {
  let s: PredictionStore;

  beforeEach(() => {
    localStorage.clear();
    _resetPredictionStore();
    s = new PredictionStore();
  });

  it("セグメントでフィルタできる", () => {
    const vip: RepeatPrediction = { ...makePrediction("c-vip"), segment: "vip" };
    const dormant: RepeatPrediction = { ...makePrediction("c-dormant"), segment: "dormant" };
    s.upsert(vip);
    s.upsert(dormant);
    s.upsert(makePrediction("c-loyal")); // loyal (default)

    expect(s.bySegment("vip")).toHaveLength(1);
    expect(s.bySegment("dormant")).toHaveLength(1);
    expect(s.bySegment("loyal")).toHaveLength(1);
    expect(s.bySegment("at_risk")).toHaveLength(0);
  });
});

describe("PredictionStore — upcoming", () => {
  let s: PredictionStore;

  beforeEach(() => {
    localStorage.clear();
    _resetPredictionStore();
    s = new PredictionStore();
  });

  it("90日以内 (3ヶ月) の発注予測を返す", () => {
    const soon: RepeatPrediction = { ...makePrediction("c-soon"), predictedNextOrderMonths: 2 };
    const later: RepeatPrediction = { ...makePrediction("c-later"), predictedNextOrderMonths: 6 };
    s.upsert(soon);
    s.upsert(later);

    const results = s.upcoming(3);
    expect(results).toHaveLength(1);
    expect(results[0].customerId).toBe("c-soon");
  });

  it("upcoming(3) で predictedNextOrderMonths=3 も含まれる (境界)", () => {
    const borderline: RepeatPrediction = { ...makePrediction("c-border"), predictedNextOrderMonths: 3 };
    s.upsert(borderline);
    expect(s.upcoming(3)).toHaveLength(1);
  });
});

describe("PredictionStore — EventTarget", () => {
  it("upsert 時に prediction-added イベントが発火する", () => {
    localStorage.clear();
    const s = new PredictionStore();
    const events: RepeatPrediction[] = [];
    s.addEventListener("prediction-added", (e) => {
      events.push((e as CustomEvent<RepeatPrediction>).detail);
    });
    s.upsert(makePrediction("c001"));
    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe("c001");
  });
});
