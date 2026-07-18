import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, Task } from "../domain/types.js";
import type { Repository } from "../domain/repository.js";
import { ensureFirstRunProject } from "./sample-project.js";

function makeRepository<T extends { id: string; createdAt: string; updatedAt: string }>(
  initial: T[] = [],
): Repository<T> {
  const items = new Map(initial.map((item) => [item.id, item]));
  return {
    async findById(id) {
      return items.get(id) ?? null;
    },
    async findAll() {
      return [...items.values()];
    },
    async create(entity) {
      items.set(entity.id, entity);
      return entity;
    },
    async update(id, fields) {
      const current = items.get(id);
      if (!current) return null;
      const next = { ...current, ...fields, updatedAt: new Date().toISOString() };
      items.set(id, next);
      return next;
    },
    async delete(id) {
      return items.delete(id);
    },
  };
}

describe("ensureFirstRunProject", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
  });

  it("creates a sample project with tasks when no project exists", async () => {
    const projectRepository = makeRepository<Project>();
    const taskRepository = makeRepository<Task>();

    const result = await ensureFirstRunProject(projectRepository, taskRepository);

    expect(result.created).toBe(true);
    expect((await projectRepository.findAll())).toHaveLength(1);
    expect((await taskRepository.findAll())).toHaveLength(6);
    expect(localStorage.setItem).toHaveBeenCalledWith("genbahub:last-project-id", result.projectId);
  });

  it("reuses the most recently updated project instead of duplicating samples", async () => {
    const oldProject = {
      id: "old-project",
      name: "古い案件",
      description: "",
      status: "active",
      startDate: "2026-05-01",
      includeWeekends: true,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    } satisfies Project;
    const recentProject = {
      ...oldProject,
      id: "recent-project",
      name: "新しい案件",
      updatedAt: "2026-05-03T00:00:00.000Z",
    } satisfies Project;
    const projectRepository = makeRepository<Project>([oldProject, recentProject]);
    const taskRepository = makeRepository<Task>();

    const result = await ensureFirstRunProject(projectRepository, taskRepository);

    expect(result).toEqual({ projectId: "recent-project", created: false });
    expect((await projectRepository.findAll())).toHaveLength(2);
    expect((await taskRepository.findAll())).toHaveLength(0);
    expect(localStorage.setItem).toHaveBeenCalledWith("genbahub:last-project-id", "recent-project");
  });

  it("deduplicates concurrent first-run effects", async () => {
    const projectRepository = makeRepository<Project>();
    const taskRepository = makeRepository<Task>();
    const create = vi.spyOn(projectRepository, "create");
    const originalFindAll = projectRepository.findAll.bind(projectRepository);
    vi.spyOn(projectRepository, "findAll").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return originalFindAll();
    });

    const [left, right] = await Promise.all([
      ensureFirstRunProject(projectRepository, taskRepository),
      ensureFirstRunProject(projectRepository, taskRepository),
    ]);

    expect(left).toEqual(right);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await projectRepository.findAll()).toHaveLength(1);
    expect(await taskRepository.findAll()).toHaveLength(6);
  });
});
