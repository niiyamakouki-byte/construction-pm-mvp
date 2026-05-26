/**
 * Tests for conflict-detector.
 */

import { describe, expect, it } from "vitest";
import { detectConflicts, type ConflictDetectorContext } from "../conflict-detector.js";
import type { Craftsman, TaskAssignment, CraftsmanAssignment } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeCraftsman(overrides: Partial<Craftsman> = {}): Craftsman {
  return {
    id: "c001",
    name: "テスト職人",
    skills: ["demolition", "cleanup"],
    dailyRate: 25000,
    baseLocationLat: 35.68,
    baseLocationLng: 139.69,
    maxConcurrentSites: 1,
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
    siteLat: 35.68,
    siteLng: 139.69,
    peopleNeeded: 1,
    priority: 3,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<CraftsmanAssignment> = {}): CraftsmanAssignment {
  return {
    taskId: "t001",
    craftsmanId: "c001",
    role: "lead",
    score: 0.8,
    reasoning_ja: "テスト",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("doubleBooking", () => {
  it("同一職人が重複する期間に2タスク割当 → critical を検出", () => {
    const craftsman = makeCraftsman({ id: "c001", maxConcurrentSites: 1 });
    const task1 = makeTask({ id: "t001", startDate: "2026-06-01", endDate: "2026-06-05" });
    const task2 = makeTask({ id: "t002", startDate: "2026-06-03", endDate: "2026-06-08", taskName: "タスク2" });
    const assignments = [
      makeAssignment({ taskId: "t001", craftsmanId: "c001" }),
      makeAssignment({ taskId: "t002", craftsmanId: "c001" }),
    ];

    const ctx: ConflictDetectorContext = {
      assignments,
      tasks: [task1, task2],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    const db = conflicts.filter((c) => c.kind === "doubleBooking");
    expect(db.length).toBeGreaterThan(0);
    expect(db[0].severity).toBe("critical");
  });

  it("期間が重ならない場合は doubleBooking なし", () => {
    const craftsman = makeCraftsman({ id: "c001", maxConcurrentSites: 1 });
    const task1 = makeTask({ id: "t001", startDate: "2026-06-01", endDate: "2026-06-05" });
    const task2 = makeTask({ id: "t002", startDate: "2026-06-06", endDate: "2026-06-10", taskName: "タスク2" });
    const assignments = [
      makeAssignment({ taskId: "t001", craftsmanId: "c001" }),
      makeAssignment({ taskId: "t002", craftsmanId: "c001" }),
    ];

    const ctx: ConflictDetectorContext = {
      assignments,
      tasks: [task1, task2],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    expect(conflicts.filter((c) => c.kind === "doubleBooking")).toHaveLength(0);
  });
});

describe("skillMismatch", () => {
  it("職人がスキル 0 の場合に skillMismatch critical を検出", () => {
    const craftsman = makeCraftsman({ id: "c001", skills: ["cleanup"] });
    const task = makeTask({ id: "t001", requiredSkills: ["electrical"] });
    const assignment = makeAssignment({ taskId: "t001", craftsmanId: "c001" });

    const ctx: ConflictDetectorContext = {
      assignments: [assignment],
      tasks: [task],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    const sm = conflicts.filter((c) => c.kind === "skillMismatch");
    expect(sm.length).toBeGreaterThan(0);
    expect(sm[0].severity).toBe("critical");
  });

  it("スキル部分充足でも skillMismatch なし (score > 0)", () => {
    const craftsman = makeCraftsman({ id: "c001", skills: ["electrical"] });
    const task = makeTask({ id: "t001", requiredSkills: ["electrical", "plumbing"] });
    const assignment = makeAssignment({ taskId: "t001", craftsmanId: "c001" });

    const ctx: ConflictDetectorContext = {
      assignments: [assignment],
      tasks: [task],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    expect(conflicts.filter((c) => c.kind === "skillMismatch")).toHaveLength(0);
  });
});

describe("overcapacity", () => {
  it("maxConcurrentSites=1 で 2つの重複タスク → overcapacity warn", () => {
    const craftsman = makeCraftsman({ id: "c001", maxConcurrentSites: 1 });
    const task1 = makeTask({ id: "t001", startDate: "2026-06-01", endDate: "2026-06-10", requiredSkills: [] });
    const task2 = makeTask({ id: "t002", startDate: "2026-06-05", endDate: "2026-06-15", taskName: "タスク2", requiredSkills: [] });
    const assignments = [
      makeAssignment({ taskId: "t001", craftsmanId: "c001" }),
      makeAssignment({ taskId: "t002", craftsmanId: "c001" }),
    ];

    const ctx: ConflictDetectorContext = {
      assignments,
      tasks: [task1, task2],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    const oc = conflicts.filter((c) => c.kind === "overcapacity");
    expect(oc.length).toBeGreaterThan(0);
    expect(oc[0].severity).toBe("warn");
  });
});

describe("travelTooLong", () => {
  it("現場まで maxTravelKm を超える距離 → travelTooLong warn", () => {
    // craftsman at Tokyo, task site at Osaka (>50km)
    const craftsman = makeCraftsman({
      id: "c001",
      baseLocationLat: 35.6762,
      baseLocationLng: 139.6503,
    });
    const task = makeTask({
      id: "t001",
      siteLat: 34.6937,
      siteLng: 135.5022,
      requiredSkills: [],
    });
    const assignment = makeAssignment({ taskId: "t001", craftsmanId: "c001" });

    const ctx: ConflictDetectorContext = {
      assignments: [assignment],
      tasks: [task],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    const ttl = conflicts.filter((c) => c.kind === "travelTooLong");
    expect(ttl.length).toBeGreaterThan(0);
    expect(ttl[0].severity).toBe("warn");
  });

  it("現場が近い場合は travelTooLong なし", () => {
    const craftsman = makeCraftsman({ id: "c001", baseLocationLat: 35.68, baseLocationLng: 139.69 });
    const task = makeTask({ id: "t001", siteLat: 35.685, siteLng: 139.695, requiredSkills: [] });
    const assignment = makeAssignment({ taskId: "t001", craftsmanId: "c001" });

    const ctx: ConflictDetectorContext = {
      assignments: [assignment],
      tasks: [task],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    expect(conflicts.filter((c) => c.kind === "travelTooLong")).toHaveLength(0);
  });
});

describe("複合コンフリクト", () => {
  it("同一職人にダブルブッキング + スキル不足が同時に検出される", () => {
    const craftsman = makeCraftsman({ id: "c001", skills: ["cleanup"], maxConcurrentSites: 1 });
    const task1 = makeTask({ id: "t001", startDate: "2026-06-01", endDate: "2026-06-05", requiredSkills: ["electrical"] });
    const task2 = makeTask({ id: "t002", startDate: "2026-06-03", endDate: "2026-06-08", taskName: "タスク2", requiredSkills: ["electrical"] });
    const assignments = [
      makeAssignment({ taskId: "t001", craftsmanId: "c001" }),
      makeAssignment({ taskId: "t002", craftsmanId: "c001" }),
    ];

    const ctx: ConflictDetectorContext = {
      assignments,
      tasks: [task1, task2],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    const kinds = new Set(conflicts.map((c) => c.kind));
    expect(kinds.has("doubleBooking")).toBe(true);
    expect(kinds.has("skillMismatch")).toBe(true);
  });

  it("コンフリクトなしの場合は空配列", () => {
    const craftsman = makeCraftsman({ id: "c001", skills: ["demolition"], maxConcurrentSites: 2 });
    const task = makeTask({ id: "t001", requiredSkills: ["demolition"] });
    const assignment = makeAssignment({ taskId: "t001", craftsmanId: "c001" });

    const ctx: ConflictDetectorContext = {
      assignments: [assignment],
      tasks: [task],
      crew: [craftsman],
      maxTravelKm: 50,
    };
    const conflicts = detectConflicts(ctx);
    expect(conflicts).toHaveLength(0);
  });
});
