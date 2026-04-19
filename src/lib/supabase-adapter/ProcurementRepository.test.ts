import { describe, it, expect, beforeEach } from "vitest";
import {
  ProcurementRepository,
  type ProcurementMaterialRecord,
} from "./ProcurementRepository.js";

function makeMaterial(
  overrides: Partial<ProcurementMaterialRecord> = {},
): ProcurementMaterialRecord {
  const now = new Date().toISOString();
  return {
    id: "m-1",
    projectId: "proj-1",
    name: "LGS 65mm",
    category: "軽鉄材",
    quantity: 200,
    unit: "本",
    status: "unordered",
    dueDate: "2025-07-10",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("ProcurementRepository (InMemory mode)", () => {
  let repo: ProcurementRepository;

  beforeEach(() => {
    repo = new ProcurementRepository(false);
  });

  it("getAsync returns null for unknown id", async () => {
    expect(await repo.getAsync("missing")).toBeNull();
  });

  it("saveAsync persists material, getAsync retrieves it", async () => {
    await repo.saveAsync(makeMaterial());
    const result = await repo.getAsync("m-1");
    expect(result?.name).toBe("LGS 65mm");
    expect(result?.quantity).toBe(200);
  });

  it("listByProjectAsync filters by projectId", async () => {
    await repo.saveAsync(makeMaterial({ id: "m-a", projectId: "p-1" }));
    await repo.saveAsync(makeMaterial({ id: "m-b", projectId: "p-2" }));
    await repo.saveAsync(makeMaterial({ id: "m-c", projectId: "p-1" }));

    const items = await repo.listByProjectAsync("p-1");
    expect(items).toHaveLength(2);
    expect(items.map((m) => m.id).sort()).toEqual(["m-a", "m-c"]);
  });

  it("saveAsync updates existing record", async () => {
    await repo.saveAsync(makeMaterial());
    await repo.saveAsync(makeMaterial({ status: "ordered" }));
    const result = await repo.getAsync("m-1");
    expect(result?.status).toBe("ordered");
  });

  it("preserves all 4 statuses", async () => {
    for (const status of [
      "unordered",
      "ordered",
      "delivered",
      "accepted",
    ] as const) {
      await repo.saveAsync(makeMaterial({ id: `m-${status}`, status }));
      const result = await repo.getAsync(`m-${status}`);
      expect(result?.status).toBe(status);
    }
  });

  it("deleteAsync returns true on existing id, false on missing", async () => {
    await repo.saveAsync(makeMaterial());
    expect(await repo.deleteAsync("m-1")).toBe(true);
    expect(await repo.deleteAsync("m-1")).toBe(false);
    expect(await repo.getAsync("m-1")).toBeNull();
  });

  it("_reset clears state", async () => {
    await repo.saveAsync(makeMaterial());
    repo._reset();
    expect(await repo.getAsync("m-1")).toBeNull();
  });

  it("preserves dueDate string", async () => {
    await repo.saveAsync(makeMaterial({ dueDate: "2025-12-31" }));
    const result = await repo.getAsync("m-1");
    expect(result?.dueDate).toBe("2025-12-31");
  });

  it("listByProjectAsync returns empty array when no matches", async () => {
    await repo.saveAsync(makeMaterial({ projectId: "other" }));
    expect(await repo.listByProjectAsync("nonexistent")).toEqual([]);
  });

  it("saveAsync copies record (mutating caller's object does not leak)", async () => {
    const m = makeMaterial();
    await repo.saveAsync(m);
    m.quantity = 9999;
    const persisted = await repo.getAsync("m-1");
    expect(persisted?.quantity).toBe(200);
  });

  it("preserves category + unit through save/load", async () => {
    await repo.saveAsync(
      makeMaterial({ category: "床材", unit: "枚" }),
    );
    const result = await repo.getAsync("m-1");
    expect(result?.category).toBe("床材");
    expect(result?.unit).toBe("枚");
  });

  it("preserves zero quantity", async () => {
    await repo.saveAsync(makeMaterial({ quantity: 0 }));
    const result = await repo.getAsync("m-1");
    expect(result?.quantity).toBe(0);
  });

  it("deleteAsync on empty store returns false", async () => {
    expect(await repo.deleteAsync("never-saved")).toBe(false);
  });

  it("listByProjectAsync after delete excludes deleted id", async () => {
    await repo.saveAsync(makeMaterial({ id: "m-a" }));
    await repo.saveAsync(makeMaterial({ id: "m-b" }));
    await repo.deleteAsync("m-a");
    const items = await repo.listByProjectAsync("proj-1");
    expect(items.map((m) => m.id)).toEqual(["m-b"]);
  });

  it("status transitions persist across saves", async () => {
    await repo.saveAsync(makeMaterial({ status: "unordered" }));
    await repo.saveAsync(makeMaterial({ status: "ordered" }));
    await repo.saveAsync(makeMaterial({ status: "delivered" }));
    await repo.saveAsync(makeMaterial({ status: "accepted" }));
    expect((await repo.getAsync("m-1"))?.status).toBe("accepted");
  });

  it("isolates memory between repository instances", async () => {
    await repo.saveAsync(makeMaterial());
    const repo2 = new ProcurementRepository(false);
    expect(await repo2.getAsync("m-1")).toBeNull();
  });
});
