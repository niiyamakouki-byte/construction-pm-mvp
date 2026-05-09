/**
 * Smoke tests for crew-optimizer types.
 */

import { describe, expect, it } from "vitest";
import type {
  CraftsmanSkill,
  Craftsman,
  TaskAssignment,
  CraftsmanAssignment,
  CrewOptimizationResult,
} from "../types.js";
import { DEFAULT_OPTIMIZATION_CONFIG } from "../types.js";

describe("CraftsmanSkill values", () => {
  it("covers all 10 skills", () => {
    const skills: CraftsmanSkill[] = [
      "demolition",
      "drywall",
      "electrical",
      "plumbing",
      "hvac",
      "interior_finish",
      "scaffolding",
      "painting",
      "fixture_install",
      "cleanup",
    ];
    expect(skills).toHaveLength(10);
  });
});

describe("Craftsman shape", () => {
  it("can construct a valid craftsman", () => {
    const c: Craftsman = {
      id: "c001",
      name: "田中 大輔",
      skills: ["demolition", "cleanup"],
      dailyRate: 25000,
      baseLocationLat: 35.68,
      baseLocationLng: 139.69,
      maxConcurrentSites: 2,
    };
    expect(c.id).toBe("c001");
    expect(c.maxConcurrentSites).toBe(2);
  });
});

describe("TaskAssignment shape", () => {
  it("can construct a valid task", () => {
    const t: TaskAssignment = {
      id: "t001",
      projectId: "proj-001",
      projectName: "テスト案件",
      taskName: "解体工事",
      requiredSkills: ["demolition"],
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      siteLat: 35.658,
      siteLng: 139.701,
      peopleNeeded: 2,
      priority: 4,
    };
    expect(t.priority).toBe(4);
    expect(t.requiredSkills).toHaveLength(1);
  });
});

describe("DEFAULT_OPTIMIZATION_CONFIG", () => {
  it("weights sum to 1.0", () => {
    const { weightSkill, weightDistance, weightUtilization, weightPriority } =
      DEFAULT_OPTIMIZATION_CONFIG;
    const sum = weightSkill + weightDistance + weightUtilization + weightPriority;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("maxTravelKm is 50", () => {
    expect(DEFAULT_OPTIMIZATION_CONFIG.maxTravelKm).toBe(50);
  });
});

describe("CraftsmanAssignment shape", () => {
  it("role is lead or sub", () => {
    const lead: CraftsmanAssignment = {
      taskId: "t001",
      craftsmanId: "c001",
      role: "lead",
      score: 0.87,
      reasoning_ja: "スキル充足",
    };
    const sub: CraftsmanAssignment = { ...lead, role: "sub" };
    expect(lead.role).toBe("lead");
    expect(sub.role).toBe("sub");
  });
});

describe("CrewOptimizationResult shape", () => {
  it("can create a valid result", () => {
    const result: CrewOptimizationResult = {
      schedules: [],
      totalConflicts: 0,
      avgUtilizationPct: 0,
      unassignedTaskIds: [],
      generatedAt: new Date().toISOString(),
    };
    expect(result.totalConflicts).toBe(0);
    expect(result.schedules).toHaveLength(0);
  });
});
