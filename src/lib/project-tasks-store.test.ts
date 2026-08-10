import { describe, expect, it } from "vitest";
import type { Repository } from "../domain/repository.js";
import type { PersistedProjectTask } from "./project-tasks-store.js";
import { createProjectTasksStore } from "./project-tasks-store.js";
import { estimateToTasks } from "./estimate-to-tasks.js";
import type { EstimateLine } from "../estimate/types.js";

class MockRepository implements Repository<PersistedProjectTask> {
  constructor(private readonly records = new Map<string, PersistedProjectTask>()) {}

  async findById(id: string): Promise<PersistedProjectTask | null> {
    return this.records.get(id) ?? null;
  }

  async findAll(): Promise<PersistedProjectTask[]> {
    return [...this.records.values()];
  }

  async create(entity: PersistedProjectTask): Promise<PersistedProjectTask> {
    this.records.set(entity.id, structuredClone(entity));
    return structuredClone(entity);
  }

  async update(
    id: string,
    fields: Partial<Omit<PersistedProjectTask, "id" | "createdAt">>,
  ): Promise<PersistedProjectTask | null> {
    const existing = this.records.get(id);
    if (!existing) {
      return null;
    }
    const updated = {
      ...existing,
      ...structuredClone(fields),
    } as PersistedProjectTask;
    this.records.set(id, updated);
    return structuredClone(updated);
  }

  async delete(id: string): Promise<boolean> {
    return this.records.delete(id);
  }
}

function makeTask(overrides: Partial<PersistedProjectTask> = {}): PersistedProjectTask {
  return {
    id: overrides.id ?? "task-1",
    projectId: overrides.projectId ?? "project-1",
    estimateLineId: overrides.estimateLineId ?? "line-1",
    category: overrides.category ?? "内装",
    title: overrides.title ?? "クロス張り工事",
    startDate: overrides.startDate ?? "2026-05-01",
    endDate: overrides.endDate ?? "2026-05-02",
    durationDays: overrides.durationDays ?? 2,
    dependsOn: overrides.dependsOn ?? [],
    assigneeId: overrides.assigneeId,
    status: overrides.status ?? "todo",
    orderIndex: overrides.orderIndex ?? 0,
    createdAt: overrides.createdAt ?? "2026-05-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-05-01T00:00:00.000Z",
  };
}

describe("project-tasks-store", () => {
  it("fetchProjectTasks filters by projectId", async () => {
    const repository = new MockRepository(new Map([
      ["task-1", makeTask({ id: "task-1", projectId: "project-a" })],
      ["task-2", makeTask({ id: "task-2", projectId: "project-b" })],
    ]));
    const store = createProjectTasksStore(repository);

    await expect(store.fetchProjectTasks("project-a")).resolves.toEqual([
      expect.objectContaining({ id: "task-1" }),
    ]);
  });

  it("fetchProjectTasks sorts by orderIndex then createdAt", async () => {
    const repository = new MockRepository(new Map([
      ["task-2", makeTask({ id: "task-2", orderIndex: 2, createdAt: "2026-05-02T00:00:00.000Z" })],
      ["task-1", makeTask({ id: "task-1", orderIndex: 1, createdAt: "2026-05-03T00:00:00.000Z" })],
      ["task-0", makeTask({ id: "task-0", orderIndex: 1, createdAt: "2026-05-01T00:00:00.000Z" })],
    ]));
    const store = createProjectTasksStore(repository);

    const tasks = await store.fetchProjectTasks("project-1");

    expect(tasks.map((task) => task.id)).toEqual(["task-0", "task-1", "task-2"]);
  });

  it("fetchProjectTasks removes duplicate dependency ids", async () => {
    const repository = new MockRepository(new Map([
      ["task-1", makeTask({ dependsOn: ["a", "a", "b"] })],
    ]));
    const store = createProjectTasksStore(repository);

    const [task] = await store.fetchProjectTasks("project-1");

    expect(task?.dependsOn).toEqual(["a", "b"]);
  });

  it("upsertProjectTask creates a new task when it does not exist", async () => {
    const repository = new MockRepository();
    const store = createProjectTasksStore(repository);

    const created = await store.upsertProjectTask({
      ...makeTask({ id: "task-new" }),
      createdAt: undefined,
      updatedAt: undefined,
    });

    expect(created.id).toBe("task-new");
    expect(created.createdAt).toEqual(expect.any(String));
    expect(created.updatedAt).toEqual(expect.any(String));
  });

  it("upsertProjectTask preserves provided createdAt on create", async () => {
    const repository = new MockRepository();
    const store = createProjectTasksStore(repository);

    const created = await store.upsertProjectTask(makeTask({
      id: "task-created-at",
      createdAt: "2026-04-30T00:00:00.000Z",
    }));

    expect(created.createdAt).toBe("2026-04-30T00:00:00.000Z");
  });

  it("upsertProjectTask updates an existing task", async () => {
    const repository = new MockRepository(new Map([
      ["task-1", makeTask()],
    ]));
    const store = createProjectTasksStore(repository);

    const updated = await store.upsertProjectTask(makeTask({
      id: "task-1",
      title: "電気配線工事",
      status: "in_progress",
    }));

    expect(updated.title).toBe("電気配線工事");
    expect(updated.status).toBe("in_progress");
  });

  it("upsertProjectTask keeps createdAt when updating", async () => {
    const repository = new MockRepository(new Map([
      ["task-1", makeTask({ createdAt: "2026-04-01T00:00:00.000Z" })],
    ]));
    const store = createProjectTasksStore(repository);

    const updated = await store.upsertProjectTask(makeTask({
      id: "task-1",
      title: "更新後の工事",
    }));

    expect(updated.createdAt).toBe("2026-04-01T00:00:00.000Z");
  });

  it("upsertProjectTask normalizes dependency ids on update", async () => {
    const repository = new MockRepository(new Map([
      ["task-1", makeTask()],
    ]));
    const store = createProjectTasksStore(repository);

    const updated = await store.upsertProjectTask(makeTask({
      id: "task-1",
      dependsOn: ["task-a", "task-a", "task-b"],
    }));

    expect(updated.dependsOn).toEqual(["task-a", "task-b"]);
  });

  it("deleteProjectTask returns true when a task is removed", async () => {
    const repository = new MockRepository(new Map([
      ["task-1", makeTask()],
    ]));
    const store = createProjectTasksStore(repository);

    await expect(store.deleteProjectTask("task-1")).resolves.toBe(true);
  });

  it("deleteProjectTask returns false when a task does not exist", async () => {
    const store = createProjectTasksStore(new MockRepository());
    await expect(store.deleteProjectTask("missing-task")).resolves.toBe(false);
  });
});

// ── bd laporta-beads-j7vx6: cross-org id collision reproduction ──────────────
//
// project_tasks.id is a single-column global primary key. Supabase RLS hides
// other organizations' rows from SELECT (so `findById` sees null), but INSERT
// still hits the real global constraint. A repository double that models both
// halves of that behavior reproduces the exact "409 duplicate key" symptom
// from the bead when two orgs derive tasks from the same standard estimate
// template, and proves idNamespace (projectId) stops it.

class RlsScopedGloballyUniqueRepository implements Repository<PersistedProjectTask> {
  constructor(
    private readonly allRows: Map<string, PersistedProjectTask>,
    private readonly visibleOrgProjectIds: Set<string>,
  ) {}

  async findById(id: string): Promise<PersistedProjectTask | null> {
    const row = this.allRows.get(id);
    if (!row || !this.visibleOrgProjectIds.has(row.projectId)) {
      return null; // RLS: other orgs' rows are invisible, even if the id exists
    }
    return structuredClone(row);
  }

  async findAll(): Promise<PersistedProjectTask[]> {
    return [...this.allRows.values()]
      .filter((row) => this.visibleOrgProjectIds.has(row.projectId))
      .map((row) => structuredClone(row));
  }

  async create(entity: PersistedProjectTask): Promise<PersistedProjectTask> {
    if (this.allRows.has(entity.id)) {
      // Mirrors Postgres: duplicate key value violates unique constraint "project_tasks_pkey"
      throw new Error('duplicate key value violates unique constraint "project_tasks_pkey"');
    }
    this.allRows.set(entity.id, structuredClone(entity));
    return structuredClone(entity);
  }

  async update(): Promise<PersistedProjectTask | null> {
    throw new Error("not used in this test");
  }

  async delete(): Promise<boolean> {
    throw new Error("not used in this test");
  }
}

const STANDARD_LINES: EstimateLine[] = [
  { code: "DIS-001", name: "解体撤去工事", unit: "式", quantity: 1, unitPrice: 150000, amount: 150000, note: "" },
];

describe("project-tasks-store — cross-org id collision (laporta-beads-j7vx6)", () => {
  it("without idNamespace, two orgs saving the same standard template hit a duplicate-key conflict", async () => {
    const allRows = new Map<string, PersistedProjectTask>();
    const orgAStore = createProjectTasksStore(
      new RlsScopedGloballyUniqueRepository(allRows, new Set(["org-a-project-1"])),
    );
    const orgBStore = createProjectTasksStore(
      new RlsScopedGloballyUniqueRepository(allRows, new Set(["org-b-project-1"])),
    );

    const [taskA] = estimateToTasks({ lines: STANDARD_LINES, projectStartDate: "2026-08-01" }).tasks;
    await orgAStore.upsertProjectTask(makeTask({
      id: taskA.id,
      projectId: "org-a-project-1",
    }));

    const [taskB] = estimateToTasks({ lines: STANDARD_LINES, projectStartDate: "2026-08-01" }).tasks;
    await expect(orgBStore.upsertProjectTask(makeTask({
      id: taskB.id,
      projectId: "org-b-project-1",
    }))).rejects.toThrow(/duplicate key/);
  });

  it("with idNamespace=projectId, two orgs saving the same standard template both succeed", async () => {
    const allRows = new Map<string, PersistedProjectTask>();
    const orgAStore = createProjectTasksStore(
      new RlsScopedGloballyUniqueRepository(allRows, new Set(["org-a-project-1"])),
    );
    const orgBStore = createProjectTasksStore(
      new RlsScopedGloballyUniqueRepository(allRows, new Set(["org-b-project-1"])),
    );

    const [taskA] = estimateToTasks({
      lines: STANDARD_LINES,
      projectStartDate: "2026-08-01",
      idNamespace: "org-a-project-1",
    }).tasks;
    const [taskB] = estimateToTasks({
      lines: STANDARD_LINES,
      projectStartDate: "2026-08-01",
      idNamespace: "org-b-project-1",
    }).tasks;

    expect(taskA.id).not.toBe(taskB.id);

    await expect(orgAStore.upsertProjectTask(makeTask({
      id: taskA.id,
      projectId: "org-a-project-1",
    }))).resolves.toEqual(expect.objectContaining({ id: taskA.id }));

    await expect(orgBStore.upsertProjectTask(makeTask({
      id: taskB.id,
      projectId: "org-b-project-1",
    }))).resolves.toEqual(expect.objectContaining({ id: taskB.id }));
  });
});
