/**
 * ambassador-store.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ambassadorStore,
  _resetAmbassadorStore,
} from "../ambassador-store.js";
import { makeOwnerAmbassadorId } from "../types.js";
import type { OwnerAmbassador } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeAmbassador(id: string, ownerName = "田中施主"): OwnerAmbassador {
  return {
    id: makeOwnerAmbassadorId(id),
    ownerName,
    completedProjectId: "proj-001",
    registeredAt: "2026-05-09T00:00:00.000Z",
    tier: "bronze",
    referralLinkIds: [],
    contractedReferralCount: 0,
    totalContractedAmountJpy: 0,
    totalRewardAmountJpy: 0,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetAmbassadorStore();
});

describe("add / getAll", () => {
  it("追加したアンバサダーが getAll で取得できる", () => {
    const a = makeAmbassador("amb-1");
    ambassadorStore.add(a);
    expect(ambassadorStore.getAll()).toHaveLength(1);
  });

  it("複数追加できる", () => {
    ambassadorStore.add(makeAmbassador("amb-1"));
    ambassadorStore.add(makeAmbassador("amb-2"));
    expect(ambassadorStore.getAll()).toHaveLength(2);
  });

  it("getAll は新しい順に返す", () => {
    ambassadorStore.add(makeAmbassador("amb-1", "山田"));
    ambassadorStore.add(makeAmbassador("amb-2", "鈴木"));
    const all = ambassadorStore.getAll();
    expect(all[0].ownerName).toBe("鈴木");
  });
});

describe("get", () => {
  it("IDで取得できる", () => {
    const a = makeAmbassador("amb-1");
    ambassadorStore.add(a);
    const found = ambassadorStore.get(makeOwnerAmbassadorId("amb-1"));
    expect(found?.id).toBe("amb-1");
  });

  it("存在しないIDは null", () => {
    expect(ambassadorStore.get(makeOwnerAmbassadorId("nonexistent"))).toBeNull();
  });
});

describe("update", () => {
  it("部分更新できる", () => {
    const a = makeAmbassador("amb-1");
    ambassadorStore.add(a);
    const updated = ambassadorStore.update(makeOwnerAmbassadorId("amb-1"), {
      tier: "silver",
    });
    expect(updated?.tier).toBe("silver");
  });

  it("存在しないIDは null", () => {
    expect(ambassadorStore.update(makeOwnerAmbassadorId("nonexistent"), {})).toBeNull();
  });

  it("更新後に getAll で変更が反映される", () => {
    ambassadorStore.add(makeAmbassador("amb-1"));
    ambassadorStore.update(makeOwnerAmbassadorId("amb-1"), { contractedReferralCount: 3 });
    const found = ambassadorStore.get(makeOwnerAmbassadorId("amb-1"));
    expect(found?.contractedReferralCount).toBe(3);
  });
});

describe("remove", () => {
  it("削除後は getAll に含まれない", () => {
    const a = makeAmbassador("amb-1");
    ambassadorStore.add(a);
    ambassadorStore.remove(makeOwnerAmbassadorId("amb-1"));
    expect(ambassadorStore.getAll()).toHaveLength(0);
  });
});

describe("clear", () => {
  it("全件削除できる", () => {
    ambassadorStore.add(makeAmbassador("amb-1"));
    ambassadorStore.add(makeAmbassador("amb-2"));
    ambassadorStore.clear();
    expect(ambassadorStore.getAll()).toHaveLength(0);
  });
});

describe("subscribe", () => {
  it("add 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    const unsubscribe = ambassadorStore.subscribe(listener);
    ambassadorStore.add(makeAmbassador("amb-1"));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("unsubscribe 後はリスナーが呼ばれない", () => {
    const listener = vi.fn();
    const unsubscribe = ambassadorStore.subscribe(listener);
    unsubscribe();
    ambassadorStore.add(makeAmbassador("amb-1"));
    expect(listener).not.toHaveBeenCalled();
  });

  it("update 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    ambassadorStore.add(makeAmbassador("amb-1"));
    const unsubscribe = ambassadorStore.subscribe(listener);
    ambassadorStore.update(makeOwnerAmbassadorId("amb-1"), { tier: "gold" });
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("remove 時にリスナーが呼ばれる", () => {
    const listener = vi.fn();
    ambassadorStore.add(makeAmbassador("amb-1"));
    const unsubscribe = ambassadorStore.subscribe(listener);
    ambassadorStore.remove(makeOwnerAmbassadorId("amb-1"));
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });
});

describe("FIFO / persist", () => {
  it("localStorage に保存される", () => {
    ambassadorStore.add(makeAmbassador("amb-1"));
    const raw = localStorage.getItem("genbahub.owner_ambassadors");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
  });

  it("singleton: 別インスタンス参照でも同じデータ", () => {
    ambassadorStore.add(makeAmbassador("amb-1"));
    _resetAmbassadorStore();
    // Recreate via proxy — should reload from localStorage
    expect(ambassadorStore.getAll()).toHaveLength(1);
  });
});
