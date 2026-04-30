/**
 * EstimateToTasks tests (Sprint 3-7)
 */

import { describe, it, expect } from "vitest";
import {
  estimateToTasks,
  groupTasksByCategory,
} from "./estimate-to-tasks.js";
import type { EstimateLine } from "../estimate/types.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function line(overrides: Partial<EstimateLine> & { name: string }): EstimateLine {
  return {
    code: "X-001",
    unit: "式",
    quantity: 1,
    unitPrice: 10000,
    amount: 10000,
    note: "",
    ...overrides,
  };
}

const START = "2026-05-01"; // Friday

// ── Basic generation ──────────────────────────────────────────────────────────

describe("estimateToTasks — basic", () => {
  it("empty lines returns empty tasks and totalDays 1", () => {
    const result = estimateToTasks({ lines: [], projectStartDate: START });
    expect(result.tasks).toHaveLength(0);
    expect(result.totalDays).toBe(1);
  });

  it("single line produces one task", () => {
    const result = estimateToTasks({
      lines: [line({ name: "クロス張り工事" })],
      projectStartDate: START,
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe("クロス張り工事");
  });

  it("task startDate matches projectStartDate", () => {
    const result = estimateToTasks({
      lines: [line({ name: "解体工事" })],
      projectStartDate: "2026-05-10",
    });
    expect(result.tasks[0].startDate).toBe("2026-05-10");
  });

  it("zero-amount lines are skipped", () => {
    const result = estimateToTasks({
      lines: [
        line({ name: "備考欄", amount: 0 }),
        line({ name: "クロス張り工事" }),
      ],
      projectStartDate: START,
    });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].name).toBe("クロス張り工事");
  });

  it("tasks are sequential — second task starts day after first ends", () => {
    const result = estimateToTasks({
      lines: [
        line({ name: "クロス張り工事", code: "A" }),
        line({ name: "フローリング工事", code: "B" }),
      ],
      projectStartDate: "2026-05-01",
    });
    const [t1, t2] = result.tasks;
    // t1 starts 2026-05-01, クロス=2 days → ends 2026-05-02
    // t2 starts 2026-05-03
    expect(t1.endDate).toBe("2026-05-02");
    expect(t2.startDate).toBe("2026-05-03");
  });

  it("task id is stable and unique", () => {
    const result = estimateToTasks({
      lines: [
        line({ name: "A", code: "A-001" }),
        line({ name: "B", code: "B-001" }),
      ],
      projectStartDate: START,
    });
    const ids = result.tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("task status defaults to todo", () => {
    const result = estimateToTasks({
      lines: [line({ name: "塗装工事" })],
      projectStartDate: START,
    });
    expect(result.tasks[0].status).toBe("todo");
  });

  it("estimateLineCode copies from line.code", () => {
    const result = estimateToTasks({
      lines: [line({ name: "解体工事", code: "DIS-001" })],
      projectStartDate: START,
    });
    expect(result.tasks[0].estimateLineCode).toBe("DIS-001");
  });

  it("note is carried over from line.note", () => {
    const result = estimateToTasks({
      lines: [line({ name: "電気工事", note: "100V配線" })],
      projectStartDate: START,
    });
    expect(result.tasks[0].note).toBe("100V配線");
  });
});

// ── Duration templates ────────────────────────────────────────────────────────

describe("estimateToTasks — duration templates", () => {
  const cases: Array<[string, number, string]> = [
    ["解体工事", 3, "解体工事"],
    ["LGS間仕切工事", 4, "内装下地"],
    ["クロス張り仕上", 2, "内装仕上"],
    ["フローリング張り工事", 2, "床工事"],
    ["電気配線工事", 3, "電気工事"],
    ["給排水配管工事", 3, "設備工事"],
    ["塗装AEP仕上", 3, "塗装工事"],
    ["建具取付工事", 2, "建具工事"],
    ["家具造作棚取付", 4, "家具工事"],
    ["防水シーリング工事", 2, "防水工事"],
    ["清掃工事", 1, "清掃工事"],
    ["未知の工事ABC", 2, "その他工事"],
  ];

  for (const [name, expectedDays, expectedCat] of cases) {
    it(`"${name}" → ${expectedDays}日 / ${expectedCat}`, () => {
      const result = estimateToTasks({
        lines: [line({ name })],
        projectStartDate: "2026-05-01",
      });
      expect(result.tasks[0].durationDays).toBe(expectedDays);
      expect(result.tasks[0].category).toBe(expectedCat);
    });
  }
});

// ── Skip weekends ─────────────────────────────────────────────────────────────

describe("estimateToTasks — skipWeekends", () => {
  it("single 2-day task starting Friday ends Monday (skipWeekends=true)", () => {
    // 2026-05-01 = Friday
    const result = estimateToTasks({
      lines: [line({ name: "クロス張り" })],
      projectStartDate: "2026-05-01",
      skipWeekends: true,
    });
    // Day 1 = Fri 05-01, Day 2 = Mon 05-04 (skipping Sat/Sun)
    expect(result.tasks[0].startDate).toBe("2026-05-01");
    expect(result.tasks[0].endDate).toBe("2026-05-04");
  });

  it("start date on Saturday advances to Monday (skipWeekends=true)", () => {
    // 2026-05-02 = Saturday
    const result = estimateToTasks({
      lines: [line({ name: "クロス張り" })],
      projectStartDate: "2026-05-02",
      skipWeekends: true,
    });
    expect(result.tasks[0].startDate).toBe("2026-05-04"); // Monday
  });

  it("second task starts next working day after weekend (skipWeekends=true)", () => {
    // 2026-05-01 = Friday; クロス = 2 days → ends Mon 05-04
    const result = estimateToTasks({
      lines: [
        line({ name: "クロス張り", code: "A" }),
        line({ name: "フローリング", code: "B" }),
      ],
      projectStartDate: "2026-05-01",
      skipWeekends: true,
    });
    // Task 2 starts Tue 05-05
    expect(result.tasks[1].startDate).toBe("2026-05-05");
  });
});

// ── totalDays ─────────────────────────────────────────────────────────────────

describe("estimateToTasks — totalDays", () => {
  it("totalDays spans first start to last end inclusive", () => {
    const result = estimateToTasks({
      lines: [
        line({ name: "解体工事", code: "A" }),    // 3 days: 05-01→05-03
        line({ name: "クロス張り", code: "B" }),  // 2 days: 05-04→05-05
      ],
      projectStartDate: "2026-05-01",
    });
    // 05-01 to 05-05 = 5 days
    expect(result.totalDays).toBe(5);
  });
});

// ── groupTasksByCategory ──────────────────────────────────────────────────────

describe("groupTasksByCategory", () => {
  it("groups tasks by category preserving order", () => {
    const result = estimateToTasks({
      lines: [
        line({ name: "解体工事", code: "A" }),
        line({ name: "クロス張り", code: "B" }),
        line({ name: "LGS間仕切", code: "C" }),
      ],
      projectStartDate: "2026-05-01",
    });
    const grouped = groupTasksByCategory(result.tasks);
    expect([...grouped.keys()]).toEqual(["解体工事", "内装仕上", "内装下地"]);
  });

  it("tasks in same category are in the same group", () => {
    const result = estimateToTasks({
      lines: [
        line({ name: "LGS下地", code: "A" }),
        line({ name: "石膏ボード張り", code: "B" }),
      ],
      projectStartDate: "2026-05-01",
    });
    const grouped = groupTasksByCategory(result.tasks);
    // Both match 内装下地
    expect(grouped.get("内装下地")).toHaveLength(2);
  });

  it("empty tasks returns empty map", () => {
    const grouped = groupTasksByCategory([]);
    expect(grouped.size).toBe(0);
  });
});
