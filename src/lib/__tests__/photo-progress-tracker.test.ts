import { describe, expect, it } from "vitest";
import type { GeneratedSchedule, GeneratedTask } from "../ai-schedule-generator.js";
import {
  aggregateTradeProgress,
  explainDelta,
  proposeScheduleUpdate,
  reconcileWithSchedule,
} from "../photo-progress-tracker.js";
import type { ScheduleDelta, TradeProgress } from "../photo-progress-tracker.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<GeneratedTask> & Pick<GeneratedTask, "id" | "name">): GeneratedTask {
  const start = new Date("2025-04-01");
  const end = new Date("2025-04-10");
  return {
    category: "painting",
    startDate: start,
    endDate: end,
    durationDays: 10,
    dependencies: [],
    crewSize: 2,
    area: 60,
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

function makeProgress(overrides: Partial<TradeProgress> = {}): TradeProgress {
  return {
    trade: "painting",
    completionRate: 0.5,
    confidence: 0.8,
    capturedAt: new Date("2025-04-05"),
    ...overrides,
  };
}

// ─── reconcileWithSchedule ────────────────────────────────────────────────────

describe("reconcileWithSchedule", () => {
  it("returns empty array when actual rate matches expected", () => {
    // task runs Apr 1–10; asOf = Apr 5 (midpoint ~50%), actual = 50% → no delay
    const task = makeTask({
      id: "t1",
      name: "101室塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const progress = [makeProgress({ trade: "painting", completionRate: 0.5 })];
    const asOf = new Date("2025-04-05");

    const result = reconcileWithSchedule(progress, schedule, asOf);
    expect(result).toHaveLength(0);
  });

  it("detects delay when actual rate is significantly below expected", () => {
    // task Apr 1–20 (20 days); asOf = Apr 10 (midpoint = 50%); actual = 20% → delay
    const task = makeTask({
      id: "t1",
      name: "101室塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-20"),
      durationDays: 20,
    });
    const schedule = makeSchedule([task]);
    const progress = [makeProgress({ trade: "painting", completionRate: 0.2 })];
    const asOf = new Date("2025-04-10");

    const result = reconcileWithSchedule(progress, schedule, asOf);
    expect(result).toHaveLength(1);
    expect(result[0].taskId).toBe("t1");
    expect(result[0].deltaDays).toBeGreaterThan(0);
    expect(result[0].proposedEnd > result[0].currentEnd).toBe(true);
  });

  it("calculates deltaDays as ceil of (expectedRate - actualRate) × durationDays", () => {
    // task Apr 1–10 (10 days); asOf = Apr 5 so expected ≈ 44%; actual = 10% → diff ≈ 0.34
    // deltaDays = ceil(0.34 × 10) = ceil(3.4) = 4
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const asOf = new Date("2025-04-05");
    // expected rate at Apr5 from Apr1–Apr10 is (4 days of 9) ≈ 0.444
    const progress = [makeProgress({ trade: "painting", completionRate: 0.1 })];

    const result = reconcileWithSchedule(progress, schedule, asOf);
    expect(result).toHaveLength(1);
    expect(result[0].deltaDays).toBeGreaterThanOrEqual(3);
    expect(result[0].deltaDays).toBeLessThanOrEqual(5);
  });

  it("excludes stale progress when progressMaxAgeDays is set", () => {
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-20"),
      durationDays: 20,
    });
    const schedule = makeSchedule([task]);
    const oldProgress = makeProgress({
      trade: "painting",
      completionRate: 0.1,
      capturedAt: new Date("2025-04-05"),
    });
    const asOf = new Date("2025-04-15");

    const withFilter = reconcileWithSchedule([oldProgress], schedule, asOf, {
      progressMaxAgeDays: 3,
    });
    expect(withFilter).toHaveLength(0);

    const withoutFilter = reconcileWithSchedule([oldProgress], schedule, asOf);
    expect(withoutFilter.length).toBeGreaterThan(0);
  });

  it("excludes long-completed tasks beyond lookbackDays", () => {
    const task = makeTask({
      id: "t1",
      name: "古い塗装",
      startDate: new Date("2025-03-01"),
      endDate: new Date("2025-03-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const progress = [
      makeProgress({
        trade: "painting",
        completionRate: 0.5,
        capturedAt: new Date("2025-04-15"),
      }),
    ];
    const asOf = new Date("2025-04-15");

    const withTightLookback = reconcileWithSchedule(progress, schedule, asOf, {
      lookbackDays: 7,
    });
    expect(withTightLookback).toHaveLength(0);

    const withWideLookback = reconcileWithSchedule(progress, schedule, asOf, {
      lookbackDays: 60,
    });
    expect(withWideLookback.length).toBeGreaterThan(0);
  });

  it("does not match tasks of different trades", () => {
    const task = makeTask({
      id: "t1",
      name: "LGS下地",
      category: "framing",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const progress = [makeProgress({ trade: "painting", completionRate: 0.05 })];
    const asOf = new Date("2025-04-05");

    const result = reconcileWithSchedule(progress, schedule, asOf);
    expect(result).toHaveLength(0);
  });

  it("does not flag tasks that have not yet started", () => {
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-05-01"),
      endDate: new Date("2025-05-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const progress = [makeProgress({ trade: "painting", completionRate: 0.0 })];
    const asOf = new Date("2025-04-15"); // before task starts

    const result = reconcileWithSchedule(progress, schedule, asOf);
    expect(result).toHaveLength(0);
  });

  it("includes confidence from the progress entry in the delta", () => {
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const progress = [makeProgress({ trade: "painting", completionRate: 0.1, confidence: 0.75 })];
    const asOf = new Date("2025-04-05");

    const result = reconcileWithSchedule(progress, schedule, asOf);
    if (result.length > 0) {
      expect(result[0].confidence).toBe(0.75);
    }
  });
});

// ─── proposeScheduleUpdate ────────────────────────────────────────────────────

describe("proposeScheduleUpdate", () => {
  it("extends task endDate and durationDays when delta is applied", () => {
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-12"),
      deltaDays: 2,
      reason: "遅延",
      confidence: 0.8,
    };

    const updated = proposeScheduleUpdate([delta], schedule);
    const updatedTask = updated.tasks.find((t) => t.id === "t1")!;
    expect(updatedTask.endDate.toISOString().slice(0, 10)).toBe("2025-04-12");
    expect(updatedTask.durationDays).toBe(12);
  });

  it("does not apply deltas with confidence < 0.5", () => {
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-20"),
      deltaDays: 10,
      reason: "低信頼度遅延",
      confidence: 0.4,
    };

    const updated = proposeScheduleUpdate([delta], schedule);
    const updatedTask = updated.tasks.find((t) => t.id === "t1")!;
    expect(updatedTask.endDate.toISOString().slice(0, 10)).toBe("2025-04-10");
    expect(updatedTask.durationDays).toBe(10);
  });

  it("does not modify tasks not referenced by any delta", () => {
    const t1 = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const t2 = makeTask({
      id: "t2",
      name: "クロス貼り",
      category: "interior_finish",
      startDate: new Date("2025-04-11"),
      endDate: new Date("2025-04-15"),
      durationDays: 5,
    });
    const schedule = makeSchedule([t1, t2]);
    const delta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-12"),
      deltaDays: 2,
      reason: "遅延",
      confidence: 0.9,
    };

    const updated = proposeScheduleUpdate([delta], schedule);
    const updatedT2 = updated.tasks.find((t) => t.id === "t2")!;
    // t2 should NOT be automatically moved — no dependency propagation
    expect(updatedT2.endDate.toISOString().slice(0, 10)).toBe("2025-04-15");
    expect(updatedT2.durationDays).toBe(5);
  });

  it("updates project endDate when a task is extended beyond it", () => {
    const task = makeTask({
      id: "t1",
      name: "塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-10"),
      durationDays: 10,
    });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-15"),
      deltaDays: 5,
      reason: "遅延",
      confidence: 0.7,
    };

    const updated = proposeScheduleUpdate([delta], schedule);
    expect(updated.endDate.toISOString().slice(0, 10)).toBe("2025-04-15");
  });

  it("applies exact confidence boundary: 0.5 is included, 0.49 is excluded", () => {
    const task = makeTask({ id: "t1", name: "塗装" });
    const schedule = makeSchedule([task]);

    const highDelta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-15"),
      deltaDays: 5,
      reason: "低信頼度",
      confidence: 0.5,
    };
    const updated = proposeScheduleUpdate([highDelta], schedule);
    const updatedTask = updated.tasks.find((t) => t.id === "t1")!;
    expect(updatedTask.durationDays).toBe(15);

    const lowDelta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-15"),
      deltaDays: 5,
      reason: "低信頼度",
      confidence: 0.49,
    };
    const unchanged = proposeScheduleUpdate([lowDelta], makeSchedule([makeTask({ id: "t1", name: "塗装" })]));
    const unchangedTask = unchanged.tasks.find((t) => t.id === "t1")!;
    expect(unchangedTask.durationDays).toBe(10);
  });
});

// ─── aggregateTradeProgress ───────────────────────────────────────────────────

describe("aggregateTradeProgress", () => {
  it("returns the single entry unchanged for a single-item input", () => {
    const p = makeProgress({ trade: "painting", completionRate: 0.6, confidence: 0.9 });
    const result = aggregateTradeProgress([p]);

    const agg = result.get("painting")!;
    expect(agg.completionRate).toBe(0.6);
    expect(agg.confidence).toBe(0.9);
  });

  it("computes confidence-weighted average completionRate", () => {
    const p1 = makeProgress({ trade: "painting", completionRate: 0.4, confidence: 0.8 });
    const p2 = makeProgress({ trade: "painting", completionRate: 0.8, confidence: 0.2 });
    // weighted: (0.4×0.8 + 0.8×0.2) / (0.8+0.2) = (0.32 + 0.16) / 1.0 = 0.48
    const result = aggregateTradeProgress([p1, p2]);

    const agg = result.get("painting")!;
    expect(agg.completionRate).toBeCloseTo(0.48, 5);
  });

  it("groups different trades separately", () => {
    const p1 = makeProgress({ trade: "painting", completionRate: 0.5 });
    const p2 = makeProgress({ trade: "framing", completionRate: 0.9 });
    const result = aggregateTradeProgress([p1, p2]);

    expect(result.has("painting")).toBe(true);
    expect(result.has("framing")).toBe(true);
    expect(result.get("painting")!.completionRate).toBe(0.5);
    expect(result.get("framing")!.completionRate).toBe(0.9);
  });

  it("uses the most recent capturedAt as the representative timestamp", () => {
    const earlier = new Date("2025-04-01");
    const later = new Date("2025-04-05");
    const p1 = makeProgress({ trade: "painting", capturedAt: earlier });
    const p2 = makeProgress({ trade: "painting", capturedAt: later });

    const result = aggregateTradeProgress([p1, p2]);
    expect(result.get("painting")!.capturedAt.toISOString()).toBe(later.toISOString());
  });

  it("merges evidenceNotes from multiple entries", () => {
    const p1 = makeProgress({ trade: "painting", evidenceNotes: "下地見えてる" });
    const p2 = makeProgress({ trade: "painting", evidenceNotes: "仕上がりムラあり" });

    const result = aggregateTradeProgress([p1, p2]);
    const notes = result.get("painting")!.evidenceNotes ?? "";
    expect(notes).toContain("下地見えてる");
    expect(notes).toContain("仕上がりムラあり");
  });

  it("handles entries with zero confidence gracefully (falls back to simple average)", () => {
    const p1 = makeProgress({ trade: "painting", completionRate: 0.3, confidence: 0 });
    const p2 = makeProgress({ trade: "painting", completionRate: 0.7, confidence: 0 });
    // totalConf = 0, so falls back to simple average = 0.5
    const result = aggregateTradeProgress([p1, p2]);
    expect(result.get("painting")!.completionRate).toBeCloseTo(0.5, 5);
  });
});

// ─── explainDelta ─────────────────────────────────────────────────────────────

describe("explainDelta", () => {
  it("includes the task name in the output", () => {
    const task = makeTask({
      id: "task-paint-1",
      name: "101室塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-18"),
      durationDays: 18,
    });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "task-paint-1",
      currentEnd: new Date("2025-04-18"),
      proposedEnd: new Date("2025-04-20"),
      deltaDays: 2,
      reason: "【painting】期待値80%に対し実測65%（2日の遅延を検知）",
      confidence: 0.8,
    };

    const explanation = explainDelta(delta, schedule);
    expect(explanation).toContain("101室塗装");
  });

  it("includes current and proposed end dates in the output", () => {
    const task = makeTask({
      id: "task-paint-1",
      name: "101室塗装",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-04-18"),
      durationDays: 18,
    });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "task-paint-1",
      currentEnd: new Date("2025-04-18"),
      proposedEnd: new Date("2025-04-20"),
      deltaDays: 2,
      reason: "【painting】期待値80%に対し実測65%（2日の遅延を検知）",
      confidence: 0.8,
    };

    const explanation = explainDelta(delta, schedule);
    expect(explanation).toContain("4/18");
    expect(explanation).toContain("4/20");
  });

  it("includes delay day count in the reason", () => {
    const task = makeTask({ id: "t1", name: "塗装" });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-15"),
      deltaDays: 5,
      reason: "【painting】期待値70%に対し実測30%（5日の遅延を検知）",
      confidence: 0.9,
    };

    const explanation = explainDelta(delta, schedule);
    expect(explanation).toContain("5日");
  });

  it("falls back to taskId when task is not found in schedule", () => {
    const task = makeTask({ id: "real-task", name: "実在タスク" });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "missing-task-id",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-12"),
      deltaDays: 2,
      reason: "【painting】遅延",
      confidence: 0.8,
    };

    const explanation = explainDelta(delta, schedule);
    expect(explanation).toContain("missing-task-id");
  });

  it("output contains 延長提案 phrase", () => {
    const task = makeTask({ id: "t1", name: "101室塗装" });
    const schedule = makeSchedule([task]);
    const delta: ScheduleDelta = {
      taskId: "t1",
      currentEnd: new Date("2025-04-10"),
      proposedEnd: new Date("2025-04-12"),
      deltaDays: 2,
      reason: "【painting】遅延",
      confidence: 0.8,
    };

    const explanation = explainDelta(delta, schedule);
    expect(explanation).toContain("延長提案");
  });
});
