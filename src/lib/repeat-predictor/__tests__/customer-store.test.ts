/**
 * Tests for customer-store.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { CustomerStore, _resetCustomerStore } from "../customer-store.js";
import type { CustomerJobHistory } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeHistory(customerId: string): CustomerJobHistory {
  return {
    customerId,
    customerName: `顧客 ${customerId}`,
    jobs: [
      {
        jobId: `j-${customerId}-1`,
        completedAt: "2024-06-01",
        revenueYen: 1_500_000,
        marginPct: 26,
        satisfactionScore: 4,
        hasComplaint: false,
        isReferral: false,
      },
    ],
    totalLifetimeValue: 1_500_000,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CustomerStore — 基本 CRUD", () => {
  let s: CustomerStore;

  beforeEach(() => {
    localStorage.clear();
    _resetCustomerStore();
    s = new CustomerStore();
  });

  it("初期状態は空", () => {
    expect(s.all()).toHaveLength(0);
  });

  it("upsert で追加される", () => {
    s.upsert(makeHistory("c001"));
    expect(s.all()).toHaveLength(1);
  });

  it("同じ customerId で upsert すると上書き", () => {
    s.upsert(makeHistory("c001"));
    const updated = { ...makeHistory("c001"), customerName: "更新済み" };
    s.upsert(updated);
    expect(s.all()).toHaveLength(1);
    expect(s.byId("c001")?.customerName).toBe("更新済み");
  });

  it("byId で特定顧客が取得できる", () => {
    s.upsert(makeHistory("c001"));
    s.upsert(makeHistory("c002"));
    expect(s.byId("c001")).not.toBeNull();
    expect(s.byId("c999")).toBeNull();
  });

  it("clear で全件削除", () => {
    s.upsert(makeHistory("c001"));
    s.upsert(makeHistory("c002"));
    s.clear();
    expect(s.all()).toHaveLength(0);
  });
});

describe("CustomerStore — ensureSeed", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetCustomerStore();
  });

  it("空の場合にシードデータを投入する", () => {
    const s = new CustomerStore();
    s.ensureSeed();
    expect(s.all().length).toBeGreaterThan(0);
  });

  it("既存データがある場合はシードを追加しない", () => {
    const s = new CustomerStore();
    s.upsert(makeHistory("c001"));
    const countBefore = s.all().length;
    s.ensureSeed();
    expect(s.all().length).toBe(countBefore);
  });

  it("シードデータは30顧客", () => {
    const s = new CustomerStore();
    s.ensureSeed();
    expect(s.all().length).toBe(30);
  });
});

describe("CustomerStore — EventTarget", () => {
  it("upsert 時に customer-updated イベントが発火する", () => {
    localStorage.clear();
    const s = new CustomerStore();
    const events: CustomerJobHistory[] = [];
    s.addEventListener("customer-updated", (e) => {
      events.push((e as CustomEvent<CustomerJobHistory>).detail);
    });
    s.upsert(makeHistory("c001"));
    expect(events).toHaveLength(1);
    expect(events[0].customerId).toBe("c001");
  });
});
