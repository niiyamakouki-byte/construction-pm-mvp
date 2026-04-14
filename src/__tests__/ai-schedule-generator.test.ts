import { describe, expect, it } from "vitest";
import {
  getDefaultPaceData,
  generateSchedule,
  calculateCriticalPath,
  adjustScheduleForHolidays,
  compressSchedule,
  getScheduleSummary,
  buildScheduleGanttHtml,
  exportScheduleCSV,
  updatePaceFromActual,
} from "../lib/ai-schedule-generator.js";
import type {
  ProjectSpec,
  GeneratedTask,
  PaceData,
  WorkCategory,
} from "../lib/ai-schedule-generator.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSpec(overrides?: Partial<ProjectSpec>): ProjectSpec {
  return {
    projectName: "テスト内装工事",
    totalArea: 100,
    floors: 1,
    projectType: "interior_only",
    startDate: new Date("2026-05-01"),
    ...overrides,
  };
}

function makeTask(overrides?: Partial<GeneratedTask>): GeneratedTask {
  return {
    id: "t1",
    name: "解体",
    category: "demolition",
    startDate: new Date("2026-05-01"),
    endDate: new Date("2026-05-05"),
    durationDays: 5,
    dependencies: [],
    crewSize: 2,
    ...overrides,
  };
}

// ─── Default Pace Data ────────────────────────────────────────────────────────

describe("getDefaultPaceData", () => {
  it("returns at least 15 tasks", () => {
    const pace = getDefaultPaceData();
    expect(pace.length).toBeGreaterThanOrEqual(15);
  });

  it("all tasks have required fields", () => {
    const pace = getDefaultPaceData();
    for (const p of pace) {
      expect(p.taskName).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.unitArea).toBeGreaterThan(0);
      expect(p.daysPerUnit).toBeGreaterThan(0);
      expect(p.crewSize).toBeGreaterThanOrEqual(1);
    }
  });

  it("includes standard interior tasks", () => {
    const pace = getDefaultPaceData();
    const names = pace.map((p) => p.taskName);
    expect(names).toContain("解体");
    expect(names).toContain("LGS下地");
    expect(names).toContain("ボード張り");
    expect(names).toContain("クロス貼り");
    expect(names).toContain("床材施工");
    expect(names).toContain("美装");
    expect(names).toContain("電気粗配線");
    expect(names).toContain("器具付け");
  });

  it("has valid category for each task", () => {
    const validCategories: WorkCategory[] = [
      "demolition", "framing", "mep_rough", "mep_finish",
      "interior_rough", "interior_finish", "exterior", "waterproof",
      "painting", "cleaning", "other",
    ];
    const pace = getDefaultPaceData();
    for (const p of pace) {
      expect(validCategories).toContain(p.category);
    }
  });
});

// ─── Schedule Generation ──────────────────────────────────────────────────────

describe("generateSchedule", () => {
  it("generates a schedule for a 100㎡ interior renovation", () => {
    const schedule = generateSchedule(makeSpec());
    expect(schedule.projectName).toBe("テスト内装工事");
    expect(schedule.tasks.length).toBeGreaterThan(0);
    expect(schedule.totalDays).toBeGreaterThan(0);
    expect(schedule.startDate).toBeInstanceOf(Date);
    expect(schedule.endDate).toBeInstanceOf(Date);
    expect(schedule.endDate >= schedule.startDate).toBe(true);
  });

  it("all tasks have valid start/end dates", () => {
    const schedule = generateSchedule(makeSpec());
    for (const task of schedule.tasks) {
      expect(task.startDate).toBeInstanceOf(Date);
      expect(task.endDate).toBeInstanceOf(Date);
      expect(task.endDate >= task.startDate).toBe(true);
      expect(task.durationDays).toBeGreaterThanOrEqual(1);
    }
  });

  it("no task starts before its dependencies end", () => {
    const schedule = generateSchedule(makeSpec());
    const taskById = new Map(schedule.tasks.map((t) => [t.id, t]));

    for (const task of schedule.tasks) {
      for (const depId of task.dependencies) {
        const dep = taskById.get(depId);
        if (dep) {
          expect(task.startDate.getTime()).toBeGreaterThan(dep.endDate.getTime());
        }
      }
    }
  });

  it("解体 starts before ボード張り", () => {
    const schedule = generateSchedule(makeSpec());
    const kaitai = schedule.tasks.find((t) => t.name === "解体");
    const board = schedule.tasks.find((t) => t.name === "ボード張り");
    if (kaitai && board) {
      expect(kaitai.startDate.getTime()).toBeLessThan(board.startDate.getTime());
    }
  });

  it("uses custom pace data if provided", () => {
    const customPace: PaceData[] = [
      { category: "demolition", taskName: "解体", unitArea: 50, daysPerUnit: 1, crewSize: 4 },
    ];
    const schedule = generateSchedule(makeSpec({ totalArea: 100 }), customPace);
    const kaitai = schedule.tasks.find((t) => t.name === "解体");
    expect(kaitai).toBeDefined();
    expect(kaitai?.durationDays).toBe(2); // 100㎡ / 50㎡/day = 2 days
  });

  it("sets projectName from spec", () => {
    const schedule = generateSchedule(makeSpec({ projectName: "南青山リノベ" }));
    expect(schedule.projectName).toBe("南青山リノベ");
  });

  it("generatedAt is a recent date", () => {
    const before = Date.now();
    const schedule = generateSchedule(makeSpec());
    const after = Date.now();
    expect(schedule.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(schedule.generatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("exterior_only filters to exterior tasks only", () => {
    const schedule = generateSchedule(makeSpec({ projectType: "exterior_only" }));
    for (const task of schedule.tasks) {
      expect(["exterior", "waterproof", "painting"]).toContain(task.category);
    }
  });
});

// ─── Critical Path ────────────────────────────────────────────────────────────

describe("calculateCriticalPath", () => {
  it("returns empty array for empty task list", () => {
    expect(calculateCriticalPath([])).toEqual([]);
  });

  it("returns single task id for a single task", () => {
    const task = makeTask();
    const path = calculateCriticalPath([task]);
    expect(path).toEqual(["t1"]);
  });

  it("follows the longest dependency chain", () => {
    const t1 = makeTask({ id: "t1", name: "A", durationDays: 3, dependencies: [] });
    const t2 = makeTask({ id: "t2", name: "B", durationDays: 5, dependencies: ["t1"] });
    const t3 = makeTask({ id: "t3", name: "C", durationDays: 2, dependencies: ["t1"] });

    const path = calculateCriticalPath([t1, t2, t3]);
    // Critical path: t1(3) -> t2(5) = 8 vs t1(3) -> t3(2) = 5
    expect(path).toContain("t2");
    expect(path).toContain("t1");
    expect(path).not.toContain("t3");
  });

  it("returns a path through generated schedule", () => {
    const schedule = generateSchedule(makeSpec());
    expect(schedule.criticalPath.length).toBeGreaterThan(0);

    // All IDs in the critical path should exist in the task list
    const taskIds = new Set(schedule.tasks.map((t) => t.id));
    for (const id of schedule.criticalPath) {
      expect(taskIds.has(id)).toBe(true);
    }
  });
});

// ─── Holiday Adjustment ───────────────────────────────────────────────────────

describe("adjustScheduleForHolidays", () => {
  it("returns a schedule with the same task count", () => {
    const schedule = generateSchedule(makeSpec());
    const adjusted = adjustScheduleForHolidays(schedule, []);
    expect(adjusted.tasks.length).toBe(schedule.tasks.length);
  });

  it("no task ends on a specified holiday", () => {
    const holidays = [new Date("2026-05-03"), new Date("2026-05-04"), new Date("2026-05-05")];
    const schedule = generateSchedule(makeSpec());
    const adjusted = adjustScheduleForHolidays(schedule, holidays);
    const holidayKeys = new Set(holidays.map((d) => d.toISOString().slice(0, 10)));

    for (const task of adjusted.tasks) {
      const endKey = task.endDate.toISOString().slice(0, 10);
      expect(holidayKeys.has(endKey)).toBe(false);
    }
  });

  it("no task starts on a weekend", () => {
    const schedule = generateSchedule(makeSpec());
    const adjusted = adjustScheduleForHolidays(schedule, []);

    for (const task of adjusted.tasks) {
      const dow = task.startDate.getDay();
      expect(dow).not.toBe(0); // Sunday
      expect(dow).not.toBe(6); // Saturday
    }
  });

  it("preserves dependency ordering after holiday adjustment", () => {
    const holidays = [new Date("2026-05-03"), new Date("2026-05-04")];
    const schedule = generateSchedule(makeSpec());
    const adjusted = adjustScheduleForHolidays(schedule, holidays);
    const taskById = new Map(adjusted.tasks.map((t) => [t.id, t]));

    for (const task of adjusted.tasks) {
      for (const depId of task.dependencies) {
        const dep = taskById.get(depId);
        if (dep) {
          expect(task.startDate.getTime()).toBeGreaterThan(dep.endDate.getTime());
        }
      }
    }
  });
});

// ─── Schedule Compression ─────────────────────────────────────────────────────

describe("compressSchedule", () => {
  it("returns the same schedule if already within target", () => {
    const schedule = generateSchedule(makeSpec());
    const compressed = compressSchedule(schedule, schedule.totalDays * 2);
    expect(compressed.tasks.length).toBe(schedule.tasks.length);
    expect(compressed.totalDays).toBe(schedule.totalDays);
  });

  it("reduces total days when target is smaller", () => {
    const schedule = generateSchedule(makeSpec());
    if (schedule.totalDays <= 2) return; // skip for trivially short schedules

    const target = Math.ceil(schedule.totalDays / 2);
    const compressed = compressSchedule(schedule, target);
    expect(compressed.totalDays).toBeLessThan(schedule.totalDays);
  });

  it("preserves dependency ordering after compression", () => {
    const schedule = generateSchedule(makeSpec());
    const target = Math.max(1, Math.floor(schedule.totalDays * 0.7));
    const compressed = compressSchedule(schedule, target);
    const taskById = new Map(compressed.tasks.map((t) => [t.id, t]));

    for (const task of compressed.tasks) {
      for (const depId of task.dependencies) {
        const dep = taskById.get(depId);
        if (dep) {
          expect(task.startDate.getTime()).toBeGreaterThan(dep.endDate.getTime());
        }
      }
    }
  });

  it("increases crew sizes when compressing", () => {
    const schedule = generateSchedule(makeSpec());
    if (schedule.totalDays <= 2) return;

    const target = Math.ceil(schedule.totalDays / 2);
    const compressed = compressSchedule(schedule, target);
    const totalOrigCrew = schedule.tasks.reduce((s, t) => s + t.crewSize, 0);
    const totalNewCrew = compressed.tasks.reduce((s, t) => s + t.crewSize, 0);
    expect(totalNewCrew).toBeGreaterThanOrEqual(totalOrigCrew);
  });

  it("no task has duration less than 1 day after compression", () => {
    const schedule = generateSchedule(makeSpec());
    const compressed = compressSchedule(schedule, 1);
    for (const task of compressed.tasks) {
      expect(task.durationDays).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── Pace Learning ────────────────────────────────────────────────────────────

describe("updatePaceFromActual", () => {
  it("updates the daysPerUnit for a matching task", () => {
    const pace = getDefaultPaceData();
    const original = pace.find((p) => p.taskName === "解体")!;
    const updated = updatePaceFromActual(pace, "解体", 6, 100);
    const updatedTask = updated.find((p) => p.taskName === "解体")!;

    // Actual: 6 days for 100㎡, pace unit is 20㎡/day → 6/(100/20)=1.2 daysPerUnit
    // EMA: 0.3 * 1.2 + 0.7 * original.daysPerUnit
    const expectedDays = 0.3 * 1.2 + 0.7 * original.daysPerUnit;
    expect(updatedTask.daysPerUnit).toBeCloseTo(expectedDays, 2);
  });

  it("does not change other tasks", () => {
    const pace = getDefaultPaceData();
    const updated = updatePaceFromActual(pace, "解体", 6, 100);

    const otherOriginal = pace.find((p) => p.taskName === "クロス貼り")!;
    const otherUpdated = updated.find((p) => p.taskName === "クロス貼り")!;
    expect(otherUpdated.daysPerUnit).toBe(otherOriginal.daysPerUnit);
  });

  it("returns the same array length", () => {
    const pace = getDefaultPaceData();
    const updated = updatePaceFromActual(pace, "床材施工", 5, 80);
    expect(updated.length).toBe(pace.length);
  });

  it("adds a note about the actual data", () => {
    const pace = getDefaultPaceData();
    const updated = updatePaceFromActual(pace, "LGS下地", 4, 60);
    const task = updated.find((p) => p.taskName === "LGS下地")!;
    expect(task.note).toContain("4日");
    expect(task.note).toContain("60㎡");
  });

  it("ignores unknown task names", () => {
    const pace = getDefaultPaceData();
    const updated = updatePaceFromActual(pace, "存在しない工事", 5, 100);
    expect(updated).toEqual(pace);
  });
});

// ─── HTML Gantt ───────────────────────────────────────────────────────────────

describe("buildScheduleGanttHtml", () => {
  it("returns a string with DOCTYPE and html tags", () => {
    const schedule = generateSchedule(makeSpec());
    const html = buildScheduleGanttHtml(schedule);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("contains the project name", () => {
    const schedule = generateSchedule(makeSpec({ projectName: "南青山プロジェクト" }));
    const html = buildScheduleGanttHtml(schedule);
    expect(html).toContain("南青山プロジェクト");
  });

  it("escapes HTML in project name", () => {
    const schedule = generateSchedule(makeSpec({ projectName: "<script>alert(1)</script>" }));
    const html = buildScheduleGanttHtml(schedule);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("contains an SVG element", () => {
    const schedule = generateSchedule(makeSpec());
    const html = buildScheduleGanttHtml(schedule);
    expect(html).toContain("<svg");
    expect(html).toContain("</svg>");
  });

  it("includes task names in the output", () => {
    const schedule = generateSchedule(makeSpec());
    const html = buildScheduleGanttHtml(schedule);
    // At least one task name should appear
    const firstTask = schedule.tasks[0];
    if (firstTask) {
      expect(html).toContain(escapeHtmlTest(firstTask.name));
    }
  });

  it("highlights critical path in red", () => {
    const schedule = generateSchedule(makeSpec());
    const html = buildScheduleGanttHtml(schedule);
    if (schedule.criticalPath.length > 0) {
      expect(html).toContain("#dc2626");
    }
  });
});

// Helper to match escapeHtml behavior in tests
function escapeHtmlTest(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

describe("exportScheduleCSV", () => {
  it("returns a string with CSV header", () => {
    const schedule = generateSchedule(makeSpec());
    const csv = exportScheduleCSV(schedule);
    expect(csv).toContain("タスク名");
    expect(csv).toContain("開始日");
    expect(csv).toContain("終了日");
    expect(csv).toContain("工期(日)");
    expect(csv).toContain("クルー数");
  });

  it("has one row per task plus header", () => {
    const schedule = generateSchedule(makeSpec());
    const csv = exportScheduleCSV(schedule);
    const lines = csv.split("\n");
    expect(lines.length).toBe(schedule.tasks.length + 1);
  });

  it("contains task names", () => {
    const schedule = generateSchedule(makeSpec());
    const csv = exportScheduleCSV(schedule);
    for (const task of schedule.tasks) {
      expect(csv).toContain(task.name);
    }
  });

  it("contains valid dates", () => {
    const schedule = generateSchedule(makeSpec({ startDate: new Date("2026-06-01") }));
    const csv = exportScheduleCSV(schedule);
    expect(csv).toContain("2026/");
  });
});

// ─── Schedule Summary ─────────────────────────────────────────────────────────

describe("getScheduleSummary", () => {
  it("returns correct task count", () => {
    const schedule = generateSchedule(makeSpec());
    const summary = getScheduleSummary(schedule);
    expect(summary.totalTasks).toBe(schedule.tasks.length);
  });

  it("returns positive peak crew", () => {
    const schedule = generateSchedule(makeSpec());
    const summary = getScheduleSummary(schedule);
    expect(summary.peakCrew).toBeGreaterThan(0);
  });

  it("critical path length matches schedule critical path", () => {
    const schedule = generateSchedule(makeSpec());
    const summary = getScheduleSummary(schedule);
    expect(summary.criticalPathLength).toBe(schedule.criticalPath.length);
  });

  it("tasksByCategory counts are non-negative", () => {
    const schedule = generateSchedule(makeSpec());
    const summary = getScheduleSummary(schedule);
    for (const count of Object.values(summary.tasksByCategory)) {
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Topological Sort: Cycle Detection ───────────────────────────────────────

describe("topologicalSort (cycle detection)", () => {
  it("throws 'Circular dependency detected' when a cycle exists", () => {
    // Build a schedule where t1 → t2 → t1 (circular)
    // We do this by generating a schedule and then manually injecting a cycle
    // via constraints that would create a circular dependency.
    // Since topologicalSort is internal, we test through generateSchedule
    // with custom pace + constraints that form a cycle.
    const customPace: PaceData[] = [
      { category: "demolition", taskName: "工事A", unitArea: 10, daysPerUnit: 1, crewSize: 1 },
      { category: "framing", taskName: "工事B", unitArea: 10, daysPerUnit: 1, crewSize: 1 },
    ];
    // 工事A must start after 工事B, AND 工事B must start after 工事A → cycle
    const constraints: import("../lib/ai-schedule-generator.js").ScheduleConstraint[] = [
      { type: "must_start_after", taskA: "工事B", taskB: "工事A" },
      { type: "must_start_after", taskA: "工事A", taskB: "工事B" },
    ];
    expect(() =>
      generateSchedule(
        makeSpec({ projectType: "interior_only" }),
        customPace,
        constraints,
      ),
    ).toThrow("Circular dependency detected");
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles single room spec", () => {
    const spec = makeSpec({
      totalArea: 20,
      rooms: [{ name: "応接室", area: 20, floor: 1 }],
    });
    const schedule = generateSchedule(spec);
    expect(schedule.tasks.length).toBeGreaterThan(0);
    expect(schedule.totalDays).toBeGreaterThan(0);
  });

  it("handles zero area gracefully (uses minimum 1 day)", () => {
    const spec = makeSpec({ totalArea: 0 });
    const schedule = generateSchedule(spec);
    for (const task of schedule.tasks) {
      expect(task.durationDays).toBeGreaterThanOrEqual(1);
    }
  });

  it("handles very large area (1000㎡)", () => {
    const spec = makeSpec({ totalArea: 1000 });
    const schedule = generateSchedule(spec);
    expect(schedule.tasks.length).toBeGreaterThan(0);
    const kaitai = schedule.tasks.find((t) => t.name === "解体");
    if (kaitai) {
      // 1000㎡ / 20㎡/day = 50 days
      expect(kaitai.durationDays).toBe(50);
    }
  });

  it("CSV export escapes commas in task names", () => {
    const schedule = generateSchedule(makeSpec());
    // Manually mutate a task name to include comma (for testing csvEscape)
    const modifiedSchedule = {
      ...schedule,
      tasks: schedule.tasks.map((t, i) =>
        i === 0 ? { ...t, name: "工事A,工事B" } : t,
      ),
    };
    const csv = exportScheduleCSV(modifiedSchedule);
    expect(csv).toContain('"工事A,工事B"');
  });

  it("compressSchedule with targetDays=0 returns original", () => {
    const schedule = generateSchedule(makeSpec());
    const result = compressSchedule(schedule, 0);
    expect(result.totalDays).toBe(schedule.totalDays);
  });
});
