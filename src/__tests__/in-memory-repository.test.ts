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
    includeWeekends: true,
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

  it("create で同一IDが既に存在する場合はエラーを投げる", async () => {
    await repo.create(sampleProject);
    await expect(repo.create(sampleProject)).rejects.toThrow(
      'Entity with id "p-1" already exists',
    );
  });

  it("findById の返り値を変更してもストア内部に影響しない", async () => {
    await repo.create(sampleProject);
    const found = await repo.findById("p-1");
    found!.name = "改ざん";
    const again = await repo.findById("p-1");
    expect(again!.name).toBe("新築工事A");
  });

  it("findAll の返り値を変更してもストア内部に影響しない", async () => {
    await repo.create(sampleProject);
    const all = await repo.findAll();
    all[0].name = "改ざん";
    const fresh = await repo.findAll();
    expect(fresh[0].name).toBe("新築工事A");
  });

  it("create に渡したオブジェクトを後から変更してもストアに影響しない", async () => {
    const input = { ...sampleProject };
    await repo.create(input);
    input.name = "改ざん";
    const stored = await repo.findById("p-1");
    expect(stored!.name).toBe("新築工事A");
  });

  it("update の返り値を変更してもストア内部に影響しない", async () => {
    await repo.create(sampleProject);
    const updated = await repo.update("p-1", { status: "active" });
    updated!.name = "改ざん";
    const stored = await repo.findById("p-1");
    expect(stored!.name).toBe("新築工事A");
  });
});
