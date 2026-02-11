import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryRepository } from "../infra/in-memory-repository.js";
import type { Project } from "../domain/types.js";

describe("InMemoryRepository – Project CRUD", () => {
  let repo: InMemoryRepository<Project>;

  const sampleProject: Project = {
    id: "p-1",
    name: "新築工事A",
    description: "テスト用プロジェクト",
    status: "planning",
    startDate: "2025-04-01",
    createdAt: "2025-03-01T00:00:00.000Z",
    updatedAt: "2025-03-01T00:00:00.000Z",
  };

  beforeEach(() => {
    repo = new InMemoryRepository<Project>();
  });

  it("create → findById で取得できる", async () => {
    await repo.create(sampleProject);
    const found = await repo.findById("p-1");
    expect(found).toEqual(sampleProject);
  });

  it("findAll で全件取得できる", async () => {
    await repo.create(sampleProject);
    await repo.create({ ...sampleProject, id: "p-2", name: "改修工事B" });
    const all = await repo.findAll();
    expect(all).toHaveLength(2);
  });

  it("update でフィールドが更新される", async () => {
    await repo.create(sampleProject);
    const updated = await repo.update("p-1", { status: "active" });
    expect(updated?.status).toBe("active");
    expect(updated?.createdAt).toBe(sampleProject.createdAt);
  });

  it("update で存在しないIDはnullを返す", async () => {
    const result = await repo.update("no-such-id", { status: "active" });
    expect(result).toBeNull();
  });

  it("delete で削除できる", async () => {
    await repo.create(sampleProject);
    const deleted = await repo.delete("p-1");
    expect(deleted).toBe(true);
    expect(await repo.findById("p-1")).toBeNull();
  });

  it("delete で存在しないIDはfalseを返す", async () => {
    const result = await repo.delete("no-such-id");
    expect(result).toBe(false);
  });
});
