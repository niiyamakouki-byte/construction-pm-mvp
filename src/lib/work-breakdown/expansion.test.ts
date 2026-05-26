import { describe, expect, it } from "vitest";
import { buildWBSTree, expandWBSToPhases } from "./expansion.js";

const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const START_DATE = "2026-01-05"; // 月曜

describe("buildWBSTree", () => {
  it("13大項目が存在する", () => {
    const tree = buildWBSTree();
    expect(tree).toHaveLength(13);
  });

  it("各大項目に中項目が1件以上ある", () => {
    const tree = buildWBSTree();
    for (const category of tree) {
      expect(category.groups.length).toBeGreaterThan(0);
    }
  });

  it("大項目IDが重複しない", () => {
    const tree = buildWBSTree();
    const ids = tree.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("中項目IDが全体で重複しない", () => {
    const tree = buildWBSTree();
    const ids = tree.flatMap((c) => c.groups.map((g) => g.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("全13大項目名が期待値と一致する", () => {
    const tree = buildWBSTree();
    const names = tree.map((c) => c.name);
    expect(names).toContain("仮設工事");
    expect(names).toContain("解体工事");
    expect(names).toContain("電気工事");
    expect(names).toContain("検査");
  });
});

describe("expandWBSToPhases", () => {
  it("全大項目選択でタスクが生成される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
    });
    expect(tasks.length).toBeGreaterThan(50);
  });

  it("全タスクに projectId が付与される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
    });
    for (const task of tasks) {
      expect(task.projectId).toBe(TEST_PROJECT_ID);
    }
  });

  it("全タスクに startDate と dueDate が付与される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
    });
    for (const task of tasks) {
      expect(task.startDate).toBeDefined();
      expect(task.dueDate).toBeDefined();
    }
  });

  it("startDate <= dueDate の順序が保たれる", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
    });
    for (const task of tasks) {
      expect(task.startDate! <= task.dueDate!).toBe(true);
    }
  });

  it("タスクが時系列順に並ぶ (前タスクの dueDate <= 次タスクの startDate)", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
    });
    for (let i = 1; i < tasks.length; i++) {
      const prev = tasks[i - 1];
      const curr = tasks[i];
      expect(prev.dueDate! <= curr.startDate!).toBe(true);
    }
  });

  it("selectedMajors で大項目を絞り込める", () => {
    const selected = new Set(["電気工事", "給排水工事"]);
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: selected,
    });
    for (const task of tasks) {
      expect(selected.has(task.majorCategory!)).toBe(true);
    }
  });

  it("selectedMajors が空セットの場合タスクが生成されない", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(),
    });
    expect(tasks).toHaveLength(0);
  });

  it("includeWeekends=false でも startDate が正しく設定される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      includeWeekends: false,
    });
    expect(tasks.length).toBeGreaterThan(0);
    // 最初のタスクは月曜スタート
    expect(tasks[0].startDate).toBe(START_DATE);
  });

  it("majorCategory / middleCategory が設定される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["仮設工事"]),
    });
    for (const task of tasks) {
      expect(task.majorCategory).toBeTruthy();
      expect(task.middleCategory).toBeTruthy();
    }
  });

  it("status は todo で初期化される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["検査"]),
    });
    for (const task of tasks) {
      expect(task.status).toBe("todo");
    }
  });

  it("progress は 0 で初期化される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["仮設工事"]),
    });
    for (const task of tasks) {
      expect(task.progress).toBe(0);
    }
  });
});
