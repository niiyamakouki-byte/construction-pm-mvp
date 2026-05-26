/**
 * StageTransitionEngine — unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { transition, revertLastTransition } from "../stage-transition-engine.js";
import { _resetDealStore } from "../deal-store.js";
import type { Deal } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeDeal(id: string = "d-001"): Deal {
  const now = new Date("2026-05-01T09:00:00+09:00").toISOString();
  return {
    id,
    customerName: "テスト顧客",
    currentStage: "inquiry",
    expectedAmountJpy: 1_000_000,
    probabilityPct: 5,
    expectedCloseDate: "2026-08-01",
    ownerName: "新山光輝",
    stageHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetDealStore();
});

describe("transition", () => {
  it("currentStage を更新する", () => {
    const deal = makeDeal();
    const updated = transition(deal, "first_reply");
    expect(updated.currentStage).toBe("first_reply");
  });

  it("stageHistory に遷移を追加する", () => {
    const deal = makeDeal();
    const updated = transition(deal, "first_reply");
    expect(updated.stageHistory).toHaveLength(1);
    expect(updated.stageHistory[0].fromStage).toBe("inquiry");
    expect(updated.stageHistory[0].toStage).toBe("first_reply");
  });

  it("daysInPreviousStage を計算する", () => {
    const deal = makeDeal();
    const transitionedAt = new Date("2026-05-08T09:00:00+09:00"); // 7日後
    const updated = transition(deal, "first_reply", transitionedAt);
    expect(updated.stageHistory[0].daysInPreviousStage).toBe(7);
  });

  it("won への遷移で wonAt をセットする", () => {
    const deal = makeDeal();
    const updated = transition(deal, "won");
    expect(updated.wonAt).toBeDefined();
    expect(updated.lostAt).toBeUndefined();
  });

  it("lost への遷移で lostAt をセットする", () => {
    const deal = makeDeal();
    const updated = transition(deal, "lost");
    expect(updated.lostAt).toBeDefined();
    expect(updated.wonAt).toBeUndefined();
  });

  it("複数回遷移で stageHistory が累積される", () => {
    const deal = makeDeal();
    const t1 = new Date("2026-05-03T09:00:00+09:00");
    const t2 = new Date("2026-05-07T09:00:00+09:00");
    const step1 = transition(deal, "first_reply", t1);
    const step2 = transition(step1, "site_survey", t2);
    expect(step2.stageHistory).toHaveLength(2);
    expect(step2.stageHistory[1].fromStage).toBe("first_reply");
    expect(step2.stageHistory[1].daysInPreviousStage).toBe(4);
  });

  it("元の deal を変更しない (immutable)", () => {
    const deal = makeDeal();
    const originalStage = deal.currentStage;
    transition(deal, "first_reply");
    expect(deal.currentStage).toBe(originalStage);
    expect(deal.stageHistory).toHaveLength(0);
  });
});

describe("revertLastTransition", () => {
  it("存在しないIDは null を返す", () => {
    expect(revertLastTransition("nonexistent")).toBeNull();
  });

  it("stageHistory が空の deal は変更なしで返す", async () => {
    // dealStore に保存してからテスト
    const { dealStore } = await import("../deal-store.js");
    const deal = makeDeal("d-revert-empty");
    dealStore.save(deal);
    const result = revertLastTransition("d-revert-empty");
    expect(result?.currentStage).toBe("inquiry");
    expect(result?.stageHistory).toHaveLength(0);
  });

  it("最後の遷移を取り消す", async () => {
    const { dealStore } = await import("../deal-store.js");
    const deal = makeDeal("d-revert-001");
    const t1 = new Date("2026-05-03T09:00:00+09:00");
    const stepped = transition(deal, "first_reply", t1);
    dealStore.save(stepped);

    const reverted = revertLastTransition("d-revert-001");
    expect(reverted?.currentStage).toBe("inquiry");
    expect(reverted?.stageHistory).toHaveLength(0);
  });

  it("won からの revert で wonAt をクリアする", async () => {
    const { dealStore } = await import("../deal-store.js");
    const deal = makeDeal("d-revert-won");
    const wonDeal = transition(deal, "won");
    dealStore.save(wonDeal);

    const reverted = revertLastTransition("d-revert-won");
    expect(reverted?.wonAt).toBeUndefined();
    expect(reverted?.currentStage).toBe("inquiry");
  });

  it("lost からの revert で lostAt と lossReason をクリアする", async () => {
    const { dealStore } = await import("../deal-store.js");
    const deal = makeDeal("d-revert-lost");
    const lostDeal = { ...transition(deal, "lost"), lossReason: "price" as const };
    dealStore.save(lostDeal);

    const reverted = revertLastTransition("d-revert-lost");
    expect(reverted?.lostAt).toBeUndefined();
    expect(reverted?.lossReason).toBeUndefined();
  });
});
