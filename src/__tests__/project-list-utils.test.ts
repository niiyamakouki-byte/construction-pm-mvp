import { describe, expect, it } from "vitest";
import { formatRelativeDate, computeTaskProgress } from "../pages/ProjectListPage.js";
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
