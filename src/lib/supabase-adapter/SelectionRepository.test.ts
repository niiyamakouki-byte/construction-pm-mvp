import { describe, it, expect, beforeEach } from "vitest";
import {
  SelectionRepository,
  type SelectionItemRecord,
} from "./SelectionRepository.js";

function makeItem(overrides: Partial<SelectionItemRecord> = {}): SelectionItemRecord {
  const now = new Date().toISOString();
  return {
    id: "sel-1",
    projectId: "proj-1",
    category: "床材",
    name: "リビング床材",
    options: [
      { id: "opt-1", name: "オーク", description: "15mm", unitPrice: 12000 },
      { id: "opt-2", name: "ビニル", description: "抗菌", unitPrice: 4500 },
    ],
    selectedOptionId: null,
    status: "選定中",
    clientNote: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("SelectionRepository (InMemory mode)", () => {
  let repo: SelectionRepository;

  beforeEach(() => {
    repo = new SelectionRepository(false);
  });

  it("getAsync returns null for unknown id", async () => {
    expect(await repo.getAsync("missing")).toBeNull();
  });

  it("saveAsync persists item, getAsync retrieves it", async () => {
    await repo.saveAsync(makeItem());
    const result = await repo.getAsync("sel-1");
    expect(result?.name).toBe("リビング床材");
    expect(result?.options).toHaveLength(2);
  });

  it("listByProjectAsync filters by projectId", async () => {
    await repo.saveAsync(makeItem({ id: "s-a", projectId: "p-1" }));
    await repo.saveAsync(makeItem({ id: "s-b", projectId: "p-2" }));
    await repo.saveAsync(makeItem({ id: "s-c", projectId: "p-1" }));

    const items = await repo.listByProjectAsync("p-1");
    expect(items).toHaveLength(2);
  });

  it("saveAsync updates existing record", async () => {
    await repo.saveAsync(makeItem());
    await repo.saveAsync(makeItem({ status: "承認済" }));
    const result = await repo.getAsync("sel-1");
    expect(result?.status).toBe("承認済");
  });

  it("deleteAsync returns true on existing id, false on missing", async () => {
    await repo.saveAsync(makeItem());
    expect(await repo.deleteAsync("sel-1")).toBe(true);
    expect(await repo.deleteAsync("sel-1")).toBe(false);
  });

  it("preserves selectedOptionId null/value", async () => {
    await repo.saveAsync(makeItem({ selectedOptionId: null }));
    expect((await repo.getAsync("sel-1"))?.selectedOptionId).toBeNull();

    await repo.saveAsync(makeItem({ selectedOptionId: "opt-1" }));
    expect((await repo.getAsync("sel-1"))?.selectedOptionId).toBe("opt-1");
  });

  it("preserves all 4 statuses", async () => {
    for (const status of ["選定中", "施主確認待ち", "承認済", "変更依頼"] as const) {
      await repo.saveAsync(makeItem({ id: `s-${status}`, status }));
      const result = await repo.getAsync(`s-${status}`);
      expect(result?.status).toBe(status);
    }
  });

  it("_reset clears state", async () => {
    await repo.saveAsync(makeItem());
    repo._reset();
    expect(await repo.getAsync("sel-1")).toBeNull();
  });

  it("saveAsync copies options array (push to caller's array does not leak)", async () => {
    const item = makeItem();
    await repo.saveAsync(item);
    item.options.push({ id: "opt-leaked", name: "x", description: "", unitPrice: 0 });
    const persisted = await repo.getAsync("sel-1");
    expect(persisted?.options).toHaveLength(2);
  });

  it("listByProjectAsync returns empty array when no matches", async () => {
    expect(await repo.listByProjectAsync("nonexistent")).toEqual([]);
  });

  it("preserves clientNote through save/load", async () => {
    await repo.saveAsync(makeItem({ clientNote: "もう少し明るい色で" }));
    const result = await repo.getAsync("sel-1");
    expect(result?.clientNote).toBe("もう少し明るい色で");
  });
});
