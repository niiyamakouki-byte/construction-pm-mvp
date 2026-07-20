import { describe, expect, it } from "vitest";
import { formatRelativeDate, computeTaskProgress, buildProgressMap } from "../pages/ProjectListPage.js";
import type { Task } from "../domain/types.js";

describe("formatRelativeDate", () => {
  const now = new Date("2026-06-11T10:00:00Z");

  it("同日は「今日」を返す", () => {
    expect(formatRelativeDate("2026-06-11T03:00:00Z", now)).toBe("今日");
  });

  it("1日前は「昨日」を返す", () => {
    expect(formatRelativeDate("2026-06-10T00:00:00.000Z", now)).toBe("昨日");
  });

  it("3日前は「3日前」を返す", () => {
    expect(formatRelativeDate("2026-06-08T00:00:00Z", now)).toBe("3日前");
  });

  it("1日後は「1日後」を返す", () => {
    expect(formatRelativeDate("2026-06-12T10:00:00Z", now)).toBe("1日後");
  });
});

describe("computeTaskProgress", () => {
  const makeTask = (status: Task["status"]): Task => ({
    id: crypto.randomUUID(),
    projectId: "p1",
    name: "t",
    description: "",
    status,
    progress: 0,
    dependencies: [],
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  });

  it("タスクなしは {done:0, total:0}", () => {
    expect(computeTaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it("全完了は done=total", () => {
    const tasks = [makeTask("done"), makeTask("done")];
    expect(computeTaskProgress(tasks)).toEqual({ done: 2, total: 2 });
  });

  it("混在は done のみカウント", () => {
    const tasks = [makeTask("done"), makeTask("todo"), makeTask("in_progress")];
    expect(computeTaskProgress(tasks)).toEqual({ done: 1, total: 3 });
  });
});

describe("buildProgressMap (bead 6ro59: 工程表と同じ母数)", () => {
  const makeTask = (
    projectId: string,
    status: Task["status"],
    name = "LGS・PB",
  ): Task => ({
    id: crypto.randomUUID(),
    projectId,
    name,
    description: "",
    status,
    progress: 0,
    dependencies: [],
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-01T00:00:00Z",
  });

  it("プロジェクトごとに {done, total} を集計する", () => {
    const tasks = [
      makeTask("p1", "done"),
      makeTask("p1", "todo"),
      makeTask("p2", "done"),
    ];
    const map = buildProgressMap(tasks);
    expect(map.get("p1")).toEqual({ done: 1, total: 2 });
    expect(map.get("p2")).toEqual({ done: 1, total: 1 });
  });

  it("コスト行タスク(労務費等)は母数から除外する", () => {
    const tasks = [
      makeTask("p1", "done"),
      makeTask("p1", "todo"),
      makeTask("p1", "done", "Grow 2月 労務費"),
      makeTask("p1", "done", "Grow 3月 労務費"),
    ];
    // 工程表(GanttPage)は filterScheduleTasks 適用後の 1/2 を表示するため、
    // ホーム側も 3/4 ではなく 1/2 に揃う
    expect(buildProgressMap(tasks).get("p1")).toEqual({ done: 1, total: 2 });
  });

  it("全タスクがコスト行のプロジェクトはエントリ自体が作られない", () => {
    const tasks = [makeTask("p1", "done", "Grow 2月 労務費")];
    expect(buildProgressMap(tasks).get("p1")).toBeUndefined();
  });
});
