import { describe, expect, it } from "vitest";
import { createTaskRepository } from "./task-store.js";
import type { Task } from "../domain/types.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    projectId: crypto.randomUUID(),
    name: "仮設工事",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    ...overrides,
  };
}

// Regression construction_pm_mvp-7ry / construction_pm_mvp-e0q: marking a task
// "done" without also patching progress left it stuck at a stale value (often
// 0), which every screen reading the raw progress field displayed as
// "complete but 0%". The Gantt-only display fix (effectiveProgress) covered
// the Gantt screens, but the underlying write path — createTaskRepository(),
// the single choke point used by TodayDashboardPage/ProjectDetailPage's
// handleStatusChange and every other task update in the app — still produced
// tasks with status=done and progress=0 for any screen reading progress
// directly. This test locks in the fix at that choke point.
describe("createTaskRepository — progress/status sync on update", () => {
  it("normalizes progress to 100 when status is set to done without an explicit progress", async () => {
    const repo = createTaskRepository();
    const task = makeTask({ status: "in_progress", progress: 0 });
    await repo.create(task);

    const updated = await repo.update(task.id, { status: "done" });

    expect(updated?.status).toBe("done");
    expect(updated?.progress).toBe(100);

    const reloaded = await repo.findById(task.id);
    expect(reloaded?.progress).toBe(100);
  });

  it("overrides an explicit progress value in the same patch when status is set to done", async () => {
    // Matches TaskEditModal's own done→100 sync and the display-layer rule
    // (effectiveProgress/getActualProgress): "done" always means 100%, so the
    // write path never persists a different value for a done task.
    const repo = createTaskRepository();
    const task = makeTask({ status: "in_progress", progress: 10 });
    await repo.create(task);

    const updated = await repo.update(task.id, { status: "done", progress: 42 });

    expect(updated?.status).toBe("done");
    expect(updated?.progress).toBe(100);
  });

  it("leaves progress untouched for non-done status updates", async () => {
    const repo = createTaskRepository();
    const task = makeTask({ status: "todo", progress: 0 });
    await repo.create(task);

    const updated = await repo.update(task.id, { status: "in_progress" });

    expect(updated?.status).toBe("in_progress");
    expect(updated?.progress).toBe(0);
  });

  it("leaves progress untouched when a patch has no status field at all", async () => {
    const repo = createTaskRepository();
    const task = makeTask({ status: "done", progress: 100 });
    await repo.create(task);

    const updated = await repo.update(task.id, { name: "仮設工事(改)" });

    expect(updated?.progress).toBe(100);
  });
});
