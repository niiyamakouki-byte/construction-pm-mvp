import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalStorageRepository } from "../infra/local-storage-repository.js";
import type { PersistedProjectTask } from "./project-tasks-store.js";
import { createProjectTasksStore } from "./project-tasks-store.js";

function createMockLocalStorage(available = true): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      if (!available) {
        throw new Error("localStorage unavailable");
      }
      values.set(key, value);
    },
  };
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("project-tasks-store integration", () => {
  it("persists created tasks to localStorage", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const repository = new LocalStorageRepository<PersistedProjectTask>("project_tasks");
    const store = createProjectTasksStore(repository);

    await store.upsertProjectTask(makeTask({ id: "task-created" }));

    await expect(store.fetchProjectTasks("project-1")).resolves.toEqual([
      expect.objectContaining({ id: "task-created" }),
    ]);
  });

  it("hydrates persisted tasks in a fresh store instance", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const firstStore = createProjectTasksStore(
      new LocalStorageRepository<PersistedProjectTask>("project_tasks"),
    );
    await firstStore.upsertProjectTask(makeTask({ id: "task-hydrated", orderIndex: 3 }));

    const secondStore = createProjectTasksStore(
      new LocalStorageRepository<PersistedProjectTask>("project_tasks"),
    );

    await expect(secondStore.fetchProjectTasks("project-1")).resolves.toEqual([
      expect.objectContaining({ id: "task-hydrated", orderIndex: 3 }),
    ]);
  });

  it("persists updates across store instances", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const repository = new LocalStorageRepository<PersistedProjectTask>("project_tasks");
    const store = createProjectTasksStore(repository);
    await store.upsertProjectTask(makeTask({ id: "task-update" }));

    await store.upsertProjectTask(makeTask({
      id: "task-update",
      title: "塗装工事",
      status: "done",
    }));

    const freshStore = createProjectTasksStore(
      new LocalStorageRepository<PersistedProjectTask>("project_tasks"),
    );
    await expect(freshStore.fetchProjectTasks("project-1")).resolves.toEqual([
      expect.objectContaining({ id: "task-update", title: "塗装工事", status: "done" }),
    ]);
  });

  it("deletes tasks from localStorage", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    const store = createProjectTasksStore(
      new LocalStorageRepository<PersistedProjectTask>("project_tasks"),
    );
    await store.upsertProjectTask(makeTask({ id: "task-delete" }));

    await store.deleteProjectTask("task-delete");

    await expect(store.fetchProjectTasks("project-1")).resolves.toEqual([]);
  });

  it("falls back to in-memory storage when localStorage is unavailable", async () => {
    vi.stubGlobal("localStorage", createMockLocalStorage(false));
    const store = createProjectTasksStore(
      new LocalStorageRepository<PersistedProjectTask>("project_tasks"),
    );

    await store.upsertProjectTask(makeTask({ id: "task-fallback" }));

    await expect(store.fetchProjectTasks("project-1")).resolves.toEqual([
      expect.objectContaining({ id: "task-fallback" }),
    ]);
  });
});
