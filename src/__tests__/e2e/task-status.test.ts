/**
 * E2E: タスクステータス変更フロー
 */
import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryRepository } from "../../infra/in-memory-repository.js";
import type { Task, TaskStatus } from "../../domain/types.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "下地工事",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("E2E: タスクステータス変更", () => {
  let taskRepo: InMemoryRepository<Task>;

  beforeEach(() => {
    taskRepo = new InMemoryRepository<Task>();
  });

  it("todo → in_progress に変更できる", async () => {
    await taskRepo.create(makeTask());
    const updated = await taskRepo.update("task-1", { status: "in_progress" });
    expect(updated!.status).toBe("in_progress");
  });

  it("in_progress → done に変更できる", async () => {
    await taskRepo.create(makeTask({ status: "in_progress" }));
    const updated = await taskRepo.update("task-1", { status: "done", progress: 100 });
    expect(updated!.status).toBe("done");
    expect(updated!.progress).toBe(100);
  });

  it("done → todo に巻き戻しできる", async () => {
    await taskRepo.create(makeTask({ status: "done", progress: 100 }));
    const updated = await taskRepo.update("task-1", { status: "todo", progress: 0 });
    expect(updated!.status).toBe("todo");
    expect(updated!.progress).toBe(0);
  });

  it("進捗率を段階的に更新できる", async () => {
    await taskRepo.create(makeTask());

    await taskRepo.update("task-1", { progress: 25 });
    let task = await taskRepo.findById("task-1");
    expect(task!.progress).toBe(25);

    await taskRepo.update("task-1", { progress: 75 });
    task = await taskRepo.findById("task-1");
    expect(task!.progress).toBe(75);
  });

  it("複数タスクのステータスを独立して管理できる", async () => {
    const statuses: TaskStatus[] = ["todo", "in_progress", "done"];
    for (let i = 0; i < 3; i++) {
      await taskRepo.create(makeTask({ id: `t-${i}`, status: statuses[i] }));
    }

    await taskRepo.update("t-0", { status: "in_progress" });
    await taskRepo.update("t-1", { status: "done" });

    const t0 = await taskRepo.findById("t-0");
    const t1 = await taskRepo.findById("t-1");
    const t2 = await taskRepo.findById("t-2");

    expect(t0!.status).toBe("in_progress");
    expect(t1!.status).toBe("done");
    expect(t2!.status).toBe("done"); // 元から done
  });

  it("assigneeId を設定できる", async () => {
    await taskRepo.create(makeTask());
    const updated = await taskRepo.update("task-1", { assigneeId: "user-abc" });
    expect(updated!.assigneeId).toBe("user-abc");
  });

  it("contractorId を設定できる", async () => {
    await taskRepo.create(makeTask());
    const updated = await taskRepo.update("task-1", { contractorId: "contractor-xyz" });
    expect(updated!.contractorId).toBe("contractor-xyz");
  });
});
