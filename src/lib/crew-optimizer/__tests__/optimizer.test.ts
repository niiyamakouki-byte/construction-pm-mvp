/**
 * Tests for optimizer.
 */

import { describe, expect, it } from "vitest";
import { optimize } from "../optimizer.js";
import type { Craftsman, TaskAssignment, OptimizationConfig } from "../types.js";
import { DEFAULT_OPTIMIZATION_CONFIG } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeCraftsman(id: string, skills: Craftsman["skills"] = ["demolition"]): Craftsman {
  return {
    id,
    name: `職人 ${id}`,
    skills,
    dailyRate: 25000,
    baseLocationLat: 35.68,
    baseLocationLng: 139.69,
    maxConcurrentSites: 2,
  };
}

function makeTask(id: string, overrides: Partial<TaskAssignment> = {}): TaskAssignment {
  return {
    id,
    projectId: "p001",
    projectName: "テスト案件",
    taskName: `タスク ${id}`,
    requiredSkills: ["demolition"],
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    siteLat: 35.68,
    siteLng: 139.69,
    peopleNeeded: 1,
    priority: 3,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("optimize — 空入力", () => {
  it("タスクなしで空のスケジュールが返る", () => {
    const result = optimize([], [makeCraftsman("c001")]);
    expect(result.schedules).toHaveLength(0);
    expect(result.unassignedTaskIds).toHaveLength(0);
  });

  it("職人なしで全タスクが unassigned", () => {
    const result = optimize([makeTask("t001"), makeTask("t002")], []);
    expect(result.unassignedTaskIds).toHaveLength(2);
  });
});

describe("optimize — greedy 優先順", () => {
  it("高優先度タスクが先に割り当てられる", () => {
    const crew = [makeCraftsman("c001")];
    // c001 は maxConcurrentSites=2 だが、両タスクが重複する
    const highPri = makeTask("t-high", { priority: 5, startDate: "2026-06-01", endDate: "2026-06-10" });
    const lowPri = makeTask("t-low", { priority: 1, startDate: "2026-06-01", endDate: "2026-06-10" });

    // 職人1名、maxConcurrentSites=1 で確認
    const singleCrew = [{ ...crew[0], maxConcurrentSites: 1 }];
    const result = optimize([lowPri, highPri], singleCrew);

    // 高優先度タスクが割り当てられ、低優先度が unassigned になるべき
    const allAssigned = result.schedules.flatMap((s) => s.assignments).map((a) => a.taskId);
    const assignedSet = new Set(allAssigned);
    expect(assignedSet.has("t-high")).toBe(true);
    expect(result.unassignedTaskIds).toContain("t-low");
  });
});

describe("optimize — unassigned", () => {
  it("スキル該当職人 0 → unassignedTaskIds に追加", () => {
    const crew = [makeCraftsman("c001", ["cleanup"])]; // スキル不一致
    const task = makeTask("t001", { requiredSkills: ["electrical"] });
    const result = optimize([task], crew);
    expect(result.unassignedTaskIds).toContain("t001");
  });

  it("全員ダブルブック → unassignedTaskIds に追加", () => {
    const crew = [{ ...makeCraftsman("c001"), maxConcurrentSites: 1 }];
    const task1 = makeTask("t001", { startDate: "2026-06-01", endDate: "2026-06-10", priority: 5 });
    const task2 = makeTask("t002", { startDate: "2026-06-01", endDate: "2026-06-10", priority: 3 });
    const result = optimize([task1, task2], crew);
    // t001 高優先 → 割当。t002 低優先 → 職人ビジー → unassigned
    expect(result.unassignedTaskIds).toContain("t002");
  });
});

describe("optimize — peopleNeeded", () => {
  it("peopleNeeded=2 で 2名割当 (1 lead + 1 sub)", () => {
    const crew = [makeCraftsman("c001"), makeCraftsman("c002")];
    const task = makeTask("t001", { peopleNeeded: 2 });
    const result = optimize([task], crew);
    // Assignments repeat per-day; deduplicate by craftsmanId+taskId
    const seen = new Set<string>();
    const uniqueAssignments = result.schedules
      .flatMap((s) => s.assignments)
      .filter((a) => {
        const key = `${a.taskId}:${a.craftsmanId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((a) => a.taskId === "t001");
    expect(uniqueAssignments).toHaveLength(2);
    const roles = uniqueAssignments.map((a) => a.role);
    expect(roles).toContain("lead");
    expect(roles).toContain("sub");
  });
});

describe("optimize — utilization 計算", () => {
  it("avgUtilizationPct は 0 以上 100 以下", () => {
    const crew = [makeCraftsman("c001"), makeCraftsman("c002")];
    const tasks = [makeTask("t001"), makeTask("t002")];
    const result = optimize(tasks, crew);
    expect(result.avgUtilizationPct).toBeGreaterThanOrEqual(0);
    expect(result.avgUtilizationPct).toBeLessThanOrEqual(100);
  });
});

describe("optimize — config 反映", () => {
  it("maxTravelKm=1 で遠い現場は conflict が検出される", () => {
    const crew = [makeCraftsman("c001")]; // base at 35.68, 139.69
    const task = makeTask("t001", {
      siteLat: 34.693,
      siteLng: 135.502, // Osaka ~400km
      requiredSkills: ["demolition"],
    });
    const config: OptimizationConfig = { ...DEFAULT_OPTIMIZATION_CONFIG, maxTravelKm: 1 };
    const result = optimize([task], crew, config);
    expect(result.totalConflicts).toBeGreaterThan(0);
  });
});

describe("optimize — generatedAt", () => {
  it("generatedAt は ISO 8601 形式", () => {
    const result = optimize([], []);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("optimize — schedules structure", () => {
  it("各 schedule の utilizationPct は 0..100", () => {
    const crew = [makeCraftsman("c001")];
    const tasks = [makeTask("t001")];
    const result = optimize(tasks, crew);
    for (const s of result.schedules) {
      expect(s.utilizationPct).toBeGreaterThanOrEqual(0);
      expect(s.utilizationPct).toBeLessThanOrEqual(100);
    }
  });
});
