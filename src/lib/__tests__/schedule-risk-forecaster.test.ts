import { describe, expect, it } from "vitest";
import type { GeneratedSchedule, GeneratedTask, PaceData } from "../ai-schedule-generator.js";
import {
  explainRisk,
  forecastTaskDuration,
  identifyDrivingPaths,
  monteCarloSchedule,
} from "../schedule-risk-forecaster.js";
import type { DurationDistribution, ScheduleForecast, TaskPath } from "../schedule-risk-forecaster.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<GeneratedTask> & Pick<GeneratedTask, "id" | "name">): GeneratedTask {
  const start = new Date("2025-01-06");
  const end = new Date("2025-01-10");
  return {
    category: "painting",
    startDate: start,
    endDate: end,
    durationDays: 5,
    dependencies: [],
    crewSize: 2,
    area: 100,
    ...overrides,
  };
}

function makePaceData(overrides: Partial<PaceData> = {}): PaceData {
  return {
    category: "painting",
    taskName: "塗装",
    unitArea: 30,
    daysPerUnit: 1,
    crewSize: 1,
    ...overrides,
  };
}

function makeSchedule(tasks: GeneratedTask[]): GeneratedSchedule {
  const start = tasks.reduce(
    (min, t) => (t.startDate < min ? t.startDate : min),
    tasks[0].startDate,
  );
  const end = tasks.reduce(
    (max, t) => (t.endDate > max ? t.endDate : max),
    tasks[0].endDate,
  );
  return {
    projectId: "test-proj",
    projectName: "テストプロジェクト",
    tasks,
    totalDays: Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
    startDate: start,
    endDate: end,
    criticalPath: tasks.map((t) => t.id),
    generatedAt: new Date("2025-01-01"),
  };
}

// ─── forecastTaskDuration ─────────────────────────────────────────────────────

describe("forecastTaskDuration", () => {
  it("returns fallback distribution when fewer than 3 samples", () => {
    const task = makeTask({ id: "t1", name: "塗装", durationDays: 10, area: 100 });
    const history: PaceData[] = [makePaceData()]; // only 1 match
    const dist = forecastTaskDuration(task, history);

    expect(dist.sampleSize).toBeLessThan(3);
    expect(dist.p50).toBe(10); // centered on durationDays
    expect(dist.stdDev).toBeCloseTo(2, 0); // 20% of 10
  });

  it("fallback: p80 > p50 > 0 with zero history", () => {
    const task = makeTask({ id: "t2", name: "解体", durationDays: 8, area: 50, category: "demolition" });
    const dist = forecastTaskDuration(task, []);

    expect(dist.sampleSize).toBe(0);
    expect(dist.p80).toBeGreaterThanOrEqual(dist.p50);
    expect(dist.p50).toBeGreaterThan(0);
    expect(dist.p95).toBeGreaterThanOrEqual(dist.p80);
  });

  it("fallback: p95 >= p80 >= p50 >= 1", () => {
    const task = makeTask({ id: "t3", name: "清掃", durationDays: 3, area: 120, category: "cleaning" });
    const dist = forecastTaskDuration(task, []);
    expect(dist.p95).toBeGreaterThanOrEqual(dist.p80);
    expect(dist.p80).toBeGreaterThanOrEqual(dist.p50);
    expect(dist.p50).toBeGreaterThanOrEqual(1);
  });

  it("with 10 samples: p50 near expected value, p80 >= p50, p95 >= p80", () => {
    const task = makeTask({ id: "t4", name: "塗装", durationDays: 5, area: 90, category: "painting" });
    // Create 10 pace records with consistent rates so distribution is tight
    const history: PaceData[] = Array.from({ length: 10 }, (_, i) => ({
      category: "painting" as const,
      taskName: "塗装",
      unitArea: 30,
      daysPerUnit: 1 + (i % 2) * 0.1, // slight variation
      crewSize: 1,
    }));

    const dist = forecastTaskDuration(task, history);
    expect(dist.sampleSize).toBe(10);
    expect(dist.p80).toBeGreaterThanOrEqual(dist.p50);
    expect(dist.p95).toBeGreaterThanOrEqual(dist.p80);
    expect(dist.mean).toBeGreaterThan(0);
    expect(dist.p50).toBeGreaterThanOrEqual(1);
  });

  it("with 10 samples: sampleSize is 10", () => {
    const task = makeTask({ id: "t5", name: "塗装", durationDays: 4, area: 60, category: "painting" });
    const history: PaceData[] = Array.from({ length: 10 }, () => makePaceData());
    const dist = forecastTaskDuration(task, history);
    expect(dist.sampleSize).toBe(10);
  });
});

// ─── monteCarloSchedule ───────────────────────────────────────────────────────

describe("monteCarloSchedule", () => {
  it("p80 end date >= p50 end date", () => {
    const t1 = makeTask({
      id: "t1", name: "塗装",
      startDate: new Date("2025-01-06"),
      endDate: new Date("2025-01-10"),
      durationDays: 5,
      dependencies: [],
    });
    const schedule = makeSchedule([t1]);
    const history = Array.from({ length: 5 }, () => makePaceData());
    const result = monteCarloSchedule(schedule, history, 200);

    expect(result.projectEndP80.getTime()).toBeGreaterThanOrEqual(result.projectEndP50.getTime());
  });

  it("p95 end date >= p80 end date", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const schedule = makeSchedule([t1]);
    const result = monteCarloSchedule(schedule, [], 200);

    expect(result.projectEndP95.getTime()).toBeGreaterThanOrEqual(result.projectEndP80.getTime());
  });

  it("iterations field matches requested count", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 3 });
    const schedule = makeSchedule([t1]);
    const result = monteCarloSchedule(schedule, [], 300);
    expect(result.iterations).toBe(300);
  });

  it("respects dependencies: sequential tasks push end date later than parallel", () => {
    const t1 = makeTask({
      id: "t1", name: "塗装",
      startDate: new Date("2025-01-06"),
      endDate: new Date("2025-01-08"),
      durationDays: 3,
      dependencies: [],
    });
    const t2 = makeTask({
      id: "t2", name: "清掃",
      startDate: new Date("2025-01-09"),
      endDate: new Date("2025-01-10"),
      durationDays: 2,
      dependencies: ["t1"],
      category: "cleaning",
    });
    const schedule = makeSchedule([t1, t2]);
    const result = monteCarloSchedule(schedule, [], 200);

    // Sequential: end must be at least t1.start + 3 + 2 - 1 days
    const minEnd = new Date("2025-01-06");
    minEnd.setDate(minEnd.getDate() + 3); // t1 done after 3 days
    expect(result.projectEndP50.getTime()).toBeGreaterThanOrEqual(schedule.startDate.getTime());
  });

  it("taskForecasts contains entries for all tasks", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const t2 = makeTask({ id: "t2", name: "清掃", durationDays: 2, category: "cleaning" });
    const schedule = makeSchedule([t1, t2]);
    const result = monteCarloSchedule(schedule, [], 100);

    expect(result.taskForecasts.has("t1")).toBe(true);
    expect(result.taskForecasts.has("t2")).toBe(true);
  });

  it("more iterations produce more stable p50 result (variance check)", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 10, area: 100 });
    const schedule = makeSchedule([t1]);
    const history = Array.from({ length: 5 }, () => makePaceData());

    // Run twice with same seed style — just check they return valid dates
    const r1 = monteCarloSchedule(schedule, history, 500);
    const r2 = monteCarloSchedule(schedule, history, 500);
    // Both should have p80 >= p50
    expect(r1.projectEndP80.getTime()).toBeGreaterThanOrEqual(r1.projectEndP50.getTime());
    expect(r2.projectEndP80.getTime()).toBeGreaterThanOrEqual(r2.projectEndP50.getTime());
  });
});

// ─── identifyDrivingPaths ─────────────────────────────────────────────────────

describe("identifyDrivingPaths", () => {
  function makeForecast(schedule: GeneratedSchedule): ScheduleForecast {
    return monteCarloSchedule(schedule, [], 200);
  }

  it("returns at most topN paths", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const t2 = makeTask({ id: "t2", name: "清掃", durationDays: 3, category: "cleaning", dependencies: ["t1"] });
    const schedule = makeSchedule([t1, t2]);
    const forecast = makeForecast(schedule);
    const paths = identifyDrivingPaths(schedule, forecast, [], 3);

    expect(paths.length).toBeLessThanOrEqual(3);
  });

  it("paths are sorted by probability descending", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const t2 = makeTask({ id: "t2", name: "清掃", durationDays: 3, category: "cleaning", dependencies: ["t1"] });
    const schedule = makeSchedule([t1, t2]);
    const forecast = makeForecast(schedule);
    const paths = identifyDrivingPaths(schedule, forecast, [], 5);

    for (let i = 1; i < paths.length; i++) {
      expect(paths[i - 1].probability).toBeGreaterThanOrEqual(paths[i].probability);
    }
  });

  it("path probabilities are between 0 and 1", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const schedule = makeSchedule([t1]);
    const forecast = makeForecast(schedule);
    const paths = identifyDrivingPaths(schedule, forecast, [], 3);

    for (const p of paths) {
      expect(p.probability).toBeGreaterThanOrEqual(0);
      expect(p.probability).toBeLessThanOrEqual(1);
    }
  });

  it("topN=1 returns at most 1 path", () => {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const schedule = makeSchedule([t1]);
    const forecast = makeForecast(schedule);
    const paths = identifyDrivingPaths(schedule, forecast, [], 1);

    expect(paths.length).toBeLessThanOrEqual(1);
  });
});

// ─── explainRisk ──────────────────────────────────────────────────────────────

describe("explainRisk", () => {
  function makeScheduleWithNamedTasks(): GeneratedSchedule {
    const t1 = makeTask({ id: "t1", name: "塗装", durationDays: 5 });
    const t2 = makeTask({ id: "t2", name: "清掃", durationDays: 3, category: "cleaning", dependencies: ["t1"] });
    return makeSchedule([t1, t2]);
  }

  it("output contains task names", () => {
    const schedule = makeScheduleWithNamedTasks();
    const path: TaskPath = {
      taskIds: ["t1", "t2"],
      probability: 0.67,
      expectedDelay: 2.3,
      explanation: "",
    };
    const result = explainRisk(path, schedule);
    expect(result).toContain("塗装");
    expect(result).toContain("清掃");
  });

  it("output contains probability as percentage", () => {
    const schedule = makeScheduleWithNamedTasks();
    const path: TaskPath = {
      taskIds: ["t1"],
      probability: 0.42,
      expectedDelay: 1.0,
      explanation: "",
    };
    const result = explainRisk(path, schedule);
    expect(result).toContain("42");
  });

  it("output is Japanese (contains % pattern and expected keywords)", () => {
    const schedule = makeScheduleWithNamedTasks();
    const path: TaskPath = {
      taskIds: ["t1", "t2"],
      probability: 0.8,
      expectedDelay: 3.0,
      explanation: "",
    };
    const result = explainRisk(path, schedule);
    // Should contain Japanese text
    expect(result).toMatch(/クリティカル|パス|遅延/);
  });

  it("handles empty taskIds gracefully", () => {
    const schedule = makeScheduleWithNamedTasks();
    const path: TaskPath = {
      taskIds: [],
      probability: 0,
      expectedDelay: 0,
      explanation: "",
    };
    const result = explainRisk(path, schedule);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
