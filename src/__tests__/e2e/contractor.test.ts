/**
 * E2E: 業者登録フロー
 */
import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryRepository } from "../../infra/in-memory-repository.js";
import type { Contractor } from "../../domain/types.js";

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  const now = new Date().toISOString();
  return {
    id: "contractor-1",
    name: "田中工務店",
    contactPerson: "田中太郎",
    phone: "03-1234-5678",
    email: "tanaka@example.com",
    lineId: "tanaka_koumusho",
    specialty: "内装工事",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("E2E: 業者登録", () => {
  let contractorRepo: InMemoryRepository<Contractor>;

  beforeEach(() => {
    contractorRepo = new InMemoryRepository<Contractor>();
  });

  it("業者を登録して取得できる", async () => {
    await contractorRepo.create(makeContractor());
    const found = await contractorRepo.findById("contractor-1");

    expect(found).not.toBeNull();
    expect(found!.name).toBe("田中工務店");
    expect(found!.specialty).toBe("内装工事");
  });

  it("複数業者を登録できる", async () => {
    await contractorRepo.create(makeContractor({ id: "c-1", name: "田中工務店" }));
    await contractorRepo.create(makeContractor({ id: "c-2", name: "山田建設" }));
    await contractorRepo.create(makeContractor({ id: "c-3", name: "鈴木電気工事" }));

    const all = await contractorRepo.findAll();
    expect(all).toHaveLength(3);
  });

  it("業者情報を更新できる", async () => {
    await contractorRepo.create(makeContractor());
    const updated = await contractorRepo.update("contractor-1", {
      phone: "03-9999-0000",
      specialty: "電気工事",
    });

    expect(updated!.phone).toBe("03-9999-0000");
    expect(updated!.specialty).toBe("電気工事");
    expect(updated!.name).toBe("田中工務店"); // 変更なし
  });

  it("業者を削除できる", async () => {
    await contractorRepo.create(makeContractor());
    await contractorRepo.delete("contractor-1");

    const found = await contractorRepo.findById("contractor-1");
    expect(found).toBeNull();
  });

  it("名前のみ必須フィールドで業者を作成できる", async () => {
    const now = new Date().toISOString();
    await contractorRepo.create({
      id: "c-min",
      name: "最小業者",
      createdAt: now,
      updatedAt: now,
    });

    const found = await contractorRepo.findById("c-min");
    expect(found!.name).toBe("最小業者");
    expect(found!.contactPerson).toBeUndefined();
    expect(found!.email).toBeUndefined();
  });

  it("業者名で一覧をフィルタリングできる（専門工種）", async () => {
    await contractorRepo.create(makeContractor({ id: "c-1", name: "田中電気", specialty: "電気工事" }));
    await contractorRepo.create(makeContractor({ id: "c-2", name: "山田建設", specialty: "内装工事" }));
    await contractorRepo.create(makeContractor({ id: "c-3", name: "鈴木電設", specialty: "電気工事" }));

    const all = await contractorRepo.findAll();
    const electricContractors = all.filter((c) => c.specialty === "電気工事");
    expect(electricContractors).toHaveLength(2);
    expect(electricContractors.map((c) => c.name).sort()).toEqual(["田中電気", "鈴木電設"]);
  });

  it("lineIdフィールドを設定できる", async () => {
    await contractorRepo.create(makeContractor({ lineId: "line_abc123" }));
    const found = await contractorRepo.findById("contractor-1");
    expect(found!.lineId).toBe("line_abc123");
  });
});
