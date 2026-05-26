/**
 * Tests for skill-matcher.
 */

import { describe, expect, it } from "vitest";
import { matchScore } from "../skill-matcher.js";
import type { Craftsman, TaskAssignment } from "../types.js";

function makeCraftsman(skills: Craftsman["skills"]): Craftsman {
  return {
    id: "c001",
    name: "テスト職人",
    skills,
    dailyRate: 25000,
    baseLocationLat: 35.68,
    baseLocationLng: 139.69,
    maxConcurrentSites: 2,
  };
}

function makeTask(requiredSkills: TaskAssignment["requiredSkills"]): TaskAssignment {
  return {
    id: "t001",
    projectId: "p001",
    projectName: "テスト案件",
    taskName: "テストタスク",
    requiredSkills,
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    siteLat: 35.68,
    siteLng: 139.69,
    peopleNeeded: 1,
    priority: 3,
  };
}

describe("matchScore — 全充足", () => {
  it("全必要スキルを持っている場合は 1.0", () => {
    const c = makeCraftsman(["demolition", "cleanup"]);
    const t = makeTask(["demolition", "cleanup"]);
    expect(matchScore(c, t)).toBe(1.0);
  });

  it("必要スキルが 1 つ、完全一致", () => {
    const c = makeCraftsman(["electrical"]);
    const t = makeTask(["electrical"]);
    expect(matchScore(c, t)).toBe(1.0);
  });

  it("職人が追加スキルを持っていても 1.0 (余分スキルはペナルティなし)", () => {
    const c = makeCraftsman(["demolition", "cleanup", "painting"]);
    const t = makeTask(["demolition"]);
    expect(matchScore(c, t)).toBe(1.0);
  });
});

describe("matchScore — 部分充足", () => {
  it("3スキル中 2 つ充足 → 0.667", () => {
    const c = makeCraftsman(["demolition", "cleanup"]);
    const t = makeTask(["demolition", "cleanup", "painting"]);
    expect(matchScore(c, t)).toBeCloseTo(2 / 3, 5);
  });

  it("4スキル中 1 つ充足 → 0.25", () => {
    const c = makeCraftsman(["electrical"]);
    const t = makeTask(["electrical", "plumbing", "hvac", "painting"]);
    expect(matchScore(c, t)).toBeCloseTo(0.25, 5);
  });

  it("2スキル中 1 つ充足 → 0.5", () => {
    const c = makeCraftsman(["drywall"]);
    const t = makeTask(["drywall", "painting"]);
    expect(matchScore(c, t)).toBeCloseTo(0.5, 5);
  });
});

describe("matchScore — 不足", () => {
  it("必要スキル 1 つ、持っていない → 0", () => {
    const c = makeCraftsman(["cleanup"]);
    const t = makeTask(["electrical"]);
    expect(matchScore(c, t)).toBe(0);
  });

  it("全スキル不足 → 0", () => {
    const c = makeCraftsman(["cleanup"]);
    const t = makeTask(["electrical", "plumbing", "hvac"]);
    expect(matchScore(c, t)).toBe(0);
  });
});

describe("matchScore — 空リスト", () => {
  it("必要スキルなし → 1.0 (制約なし)", () => {
    const c = makeCraftsman([]);
    const t = makeTask([]);
    expect(matchScore(c, t)).toBe(1.0);
  });

  it("職人スキルなし・必要スキルなし → 1.0", () => {
    const c = makeCraftsman([]);
    const t = makeTask([]);
    expect(matchScore(c, t)).toBe(1.0);
  });
});
