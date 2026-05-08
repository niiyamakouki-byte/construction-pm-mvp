import { describe, expect, it } from "vitest";
import { convertToWBSRows } from "./wbs-to-gantt.js";
import { expandWBSToPhases } from "./expansion.js";

const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const START_DATE = "2026-01-05";

describe("convertToWBSRows", () => {
  it("空配列を渡すと空配列を返す", () => {
    expect(convertToWBSRows([])).toHaveLength(0);
  });

  it("category 行と group 行と task 行が生成される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["電気工事"]),
    });
    const rows = convertToWBSRows(tasks);
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toContain("category");
    expect(kinds).toContain("group");
    expect(kinds).toContain("task");
  });

  it("category 行の taskCount が配下 task 行の数と等しい", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["仮設工事"]),
    });
    const rows = convertToWBSRows(tasks);
    const categoryRow = rows.find((r) => r.kind === "category");
    const taskRows = rows.filter((r) => r.kind === "task");
    expect(categoryRow).toBeDefined();
    expect(categoryRow!.taskCount).toBe(taskRows.length);
  });

  it("category 行の startDate が配下タスクの最早日", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["給排水工事"]),
    });
    const rows = convertToWBSRows(tasks);
    const categoryRow = rows.find((r) => r.kind === "category");
    const taskRows = rows.filter((r) => r.kind === "task");
    const earliest = taskRows.map((r) => r.startDate).sort()[0];
    expect(categoryRow!.startDate).toBe(earliest);
  });

  it("category 行の endDate が配下タスクの最遅日", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["給排水工事"]),
    });
    const rows = convertToWBSRows(tasks);
    const categoryRow = rows.find((r) => r.kind === "category");
    const taskRows = rows.filter((r) => r.kind === "task");
    const latest = taskRows.map((r) => r.endDate).sort().at(-1);
    expect(categoryRow!.endDate).toBe(latest);
  });

  it("task 行には task プロパティが設定される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["塗装工事"]),
    });
    const rows = convertToWBSRows(tasks);
    const taskRows = rows.filter((r) => r.kind === "task");
    for (const row of taskRows) {
      expect(row.task).toBeDefined();
    }
  });
});
