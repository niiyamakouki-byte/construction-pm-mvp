/**
 * Tests for assignment-scorer.
 */

import { describe, expect, it } from "vitest";
import { scoreAssignment } from "../assignment-scorer.js";
import type { Craftsman, TaskAssignment, OptimizationConfig } from "../types.js";
import { DEFAULT_OPTIMIZATION_CONFIG } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeCraftsman(overrides: Partial<Craftsman> = {}): Craftsman {
  return {
    id: "c001",
    name: "テスト職人",
    skills: ["demolition"],
    dailyRate: 25000,
    baseLocationLat: 35.68,
    baseLocationLng: 139.69,
    maxConcurrentSites: 2,
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id: "t001",
    projectId: "p001",
    projectName: "テスト案件",
    taskName: "テストタスク",
    requiredSkills: ["demolition"],
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    siteLat: 35.68, // same location → max distance score
    siteLng: 139.69,
    peopleNeeded: 1,
    priority: 5,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("scoreAssignment — skill weight", () => {
  it("全スキル充足・負荷なし・同地点・優先度5 → score ≈ 1.0", () => {
    const c = makeCraftsman();
    const t = makeTask();
    const score = scoreAssignment(c, t, 0, DEFAULT_OPTIMIZATION_CONFIG);
    expect(score).toBeCloseTo(1.0, 5);
  });

  it("スキル不足の職人は低スコア", () => {
    const c = makeCraftsman({ skills: ["cleanup"] });
    const t = makeTask({ requiredSkills: ["electrical"] });
    const score = scoreAssignment(c, t, 0, DEFAULT_OPTIMIZATION_CONFIG);
    // skillScore=0 なので weightSkill 分が 0
    expect(score).toBeLessThan(0.70);
  });
});

describe("scoreAssignment — distance weight", () => {
  it("遠い現場は distScore が下がる", () => {
    const c = makeCraftsman();
    const near = makeTask({ siteLat: 35.68, siteLng: 139.69 }); // same location
    const far = makeTask({ siteLat: 34.693, siteLng: 135.502 }); // Osaka ~400km

    const scoreNear = scoreAssignment(c, near, 0, DEFAULT_OPTIMIZATION_CONFIG);
    const scoreFar = scoreAssignment(c, far, 0, DEFAULT_OPTIMIZATION_CONFIG);
    expect(scoreNear).toBeGreaterThan(scoreFar);
  });
});

describe("scoreAssignment — utilization weight", () => {
  it("currentLoad=0 の方が currentLoad=0.5 より高スコア", () => {
    const c = makeCraftsman();
    const t = makeTask();
    const s0 = scoreAssignment(c, t, 0, DEFAULT_OPTIMIZATION_CONFIG);
    const s05 = scoreAssignment(c, t, 0.5, DEFAULT_OPTIMIZATION_CONFIG);
    expect(s0).toBeGreaterThan(s05);
  });

  it("currentLoad=1.0 は currentLoad=0 より低スコア", () => {
    const c = makeCraftsman();
    const t = makeTask();
    const s0 = scoreAssignment(c, t, 0, DEFAULT_OPTIMIZATION_CONFIG);
    const s1 = scoreAssignment(c, t, 1.0, DEFAULT_OPTIMIZATION_CONFIG);
    expect(s0).toBeGreaterThan(s1);
  });
});

describe("scoreAssignment — priority weight", () => {
  it("priority=5 は priority=1 より高スコア (他条件同一)", () => {
    const c = makeCraftsman();
    const tHigh = makeTask({ priority: 5 });
    const tLow = makeTask({ priority: 1 });
    const sHigh = scoreAssignment(c, tHigh, 0, DEFAULT_OPTIMIZATION_CONFIG);
    const sLow = scoreAssignment(c, tLow, 0, DEFAULT_OPTIMIZATION_CONFIG);
    expect(sHigh).toBeGreaterThan(sLow);
  });
});

describe("scoreAssignment — config override", () => {
  it("weightSkill=0 にすると スキル不足でもスコアが上がる", () => {
    const customConfig: OptimizationConfig = {
      ...DEFAULT_OPTIMIZATION_CONFIG,
      weightSkill: 0,
      weightDistance: 0.25,
      weightUtilization: 0.5,
      weightPriority: 0.25,
    };
    const c = makeCraftsman({ skills: ["cleanup"] });
    const t = makeTask({ requiredSkills: ["electrical"] });
    const score = scoreAssignment(c, t, 0, customConfig);
    // weightSkill=0 なのでスキル不足のペナルティがない
    expect(score).toBeGreaterThan(0.5);
  });
});

describe("scoreAssignment — 境界値", () => {
  it("currentLoad が 1.0 を超えても クランプされて 0 まで下がる", () => {
    const c = makeCraftsman();
    const t = makeTask();
    const score = scoreAssignment(c, t, 2.0, DEFAULT_OPTIMIZATION_CONFIG);
    // utilizationScore = 0
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("score は常に 0..1 の範囲内", () => {
    const c = makeCraftsman({ skills: [] });
    const t = makeTask({ requiredSkills: ["electrical", "plumbing"] });
    const score = scoreAssignment(c, t, 0.8);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
