import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalStorageRepository } from "../infra/local-storage-repository.js";
import type { BaseEntity } from "../domain/types.js";

type TestEntity = BaseEntity & { name: string };

// Create a proper localStorage mock since Node's built-in localStorage is incomplete
function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe("LocalStorageRepository", () => {
  let repo: LocalStorageRepository<TestEntity>;

  beforeEach(() => {
    const mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);
    repo = new LocalStorageRepository<TestEntity>("test-entities");
  });

  it("creates and retrieves an entity", async () => {
    const entity: TestEntity = {
      id: "1",
      name: "Test",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    const created = await repo.create(entity);
    expect(created.id).toBe("1");

    const found = await repo.findById("1");
    expect(found?.name).toBe("Test");
  });

  it("persists across new instances", async () => {
    const entity: TestEntity = {
      id: "2",
      name: "Persist",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    await repo.create(entity);

    // New instance reads from same localStorage key
    const repo2 = new LocalStorageRepository<TestEntity>("test-entities");
    const found = await repo2.findById("2");
    expect(found?.name).toBe("Persist");
  });

  it("findAll returns all entities", async () => {
    await repo.create({
      id: "a",
      name: "A",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    await repo.create({
      id: "b",
      name: "B",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    const all = await repo.findAll();
    expect(all.length).toBe(2);
  });

  it("throws on duplicate id", async () => {
    await repo.create({
      id: "dup",
      name: "First",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    await expect(
      repo.create({
        id: "dup",
        name: "Second",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      }),
    ).rejects.toThrow("already exists");
  });

  it("updates an entity", async () => {
    await repo.create({
      id: "u1",
      name: "Before",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    const updated = await repo.update("u1", { name: "After" });
    expect(updated?.name).toBe("After");

    const found = await repo.findById("u1");
    expect(found?.name).toBe("After");
  });

  it("returns null when updating non-existent", async () => {
    const result = await repo.update("ghost", { name: "nope" });
    expect(result).toBeNull();
  });

  it("deletes an entity", async () => {
    await repo.create({
      id: "d1",
      name: "Delete me",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    });
    const deleted = await repo.delete("d1");
    expect(deleted).toBe(true);

    const found = await repo.findById("d1");
    expect(found).toBeNull();
  });

  it("returns false when deleting non-existent", async () => {
    const result = await repo.delete("nope");
    expect(result).toBe(false);
  });
});
