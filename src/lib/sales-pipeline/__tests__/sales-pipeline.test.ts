/**
 * SalesPipeline facade — unit tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  intakeFromInquiry,
  transitionDeal,
  markWon,
  markLost,
  currentSnapshot,
  riskAlerts,
  _resetDealIdCounter,
} from "../sales-pipeline.js";
import { _resetDealStore, dealStore } from "../deal-store.js";
import type { InquiryRecord } from "../../inquiry-responder/types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

function makeInquiry(overrides: Partial<InquiryRecord> = {}): InquiryRecord {
  const now = new Date().toISOString();
  return {
    id: "inq-001",
    channel: "hp_form",
    receivedAt: now,
    rawText: "キッチンのリフォームをお願いしたい",
    customerName: "田中花子",
    customerContact: null,
    extractedRequirements: {
      workCategory: "kitchen",
      workScale: "medium",
      locationCity: "世田谷区",
      budgetHintJpy: null,
      desiredStartMonth: null,
      contactPreference: null,
    },
    estimatedRangeJpy: {
      lowerJpy: 1_000_000,
      upperJpy: 3_000_000,
      confidence: "low",
      basisNotes_ja: "テスト",
    },
    proposedSlots: [],
    draftReplyJa: "テスト返信",
    status: "triaged",
    priority: "normal",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetDealStore();
  _resetDealIdCounter();
});

// ── intakeFromInquiry ──────────────────────────────────────────────────────

describe("intakeFromInquiry", () => {
  it("InquiryRecord から Deal を生成する", () => {
    const inquiry = makeInquiry();
    const deal = intakeFromInquiry(inquiry);
    expect(deal).toBeDefined();
    expect(deal.id).toBeTruthy();
    expect(deal.inquiryId).toBe("inq-001");
  });

  it("customerName を引き継ぐ", () => {
    const inquiry = makeInquiry({ customerName: "田中花子" });
    const deal = intakeFromInquiry(inquiry);
    expect(deal.customerName).toBe("田中花子");
  });

  it("customerName が null の場合は '不明' にする", () => {
    const inquiry = makeInquiry({ customerName: null });
    const deal = intakeFromInquiry(inquiry);
    expect(deal.customerName).toBe("不明");
  });

  it("初期ステージは inquiry", () => {
    const deal = intakeFromInquiry(makeInquiry());
    expect(deal.currentStage).toBe("inquiry");
  });

  it("expectedAmountJpy は estimatedRangeJpy.upperJpy", () => {
    const deal = intakeFromInquiry(makeInquiry());
    expect(deal.expectedAmountJpy).toBe(3_000_000);
  });

  it("probabilityPct は inquiry のデフォルト (5%)", () => {
    const deal = intakeFromInquiry(makeInquiry());
    expect(deal.probabilityPct).toBe(5);
  });

  it("dealStore に保存される", () => {
    intakeFromInquiry(makeInquiry());
    expect(dealStore.getAll()).toHaveLength(1);
  });

  it("Sprint 16-A 連携: 複数 InquiryRecord から独立した Deal を生成", () => {
    const inq1 = makeInquiry({ id: "inq-001", customerName: "田中" });
    const inq2 = makeInquiry({ id: "inq-002", customerName: "佐藤" });
    const deal1 = intakeFromInquiry(inq1);
    const deal2 = intakeFromInquiry(inq2);
    expect(deal1.id).not.toBe(deal2.id);
    expect(deal1.inquiryId).toBe("inq-001");
    expect(deal2.inquiryId).toBe("inq-002");
  });
});

// ── transitionDeal ─────────────────────────────────────────────────────────

describe("transitionDeal", () => {
  it("ステージを遷移させる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = transitionDeal(deal.id, "first_reply");
    expect(updated?.currentStage).toBe("first_reply");
  });

  it("存在しないIDは null を返す", () => {
    expect(transitionDeal("nonexistent", "first_reply")).toBeNull();
  });

  it("stageHistory に追加される", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = transitionDeal(deal.id, "first_reply");
    expect(updated?.stageHistory).toHaveLength(1);
  });

  it("dealStore が更新される", () => {
    const deal = intakeFromInquiry(makeInquiry());
    transitionDeal(deal.id, "first_reply");
    expect(dealStore.byId(deal.id)?.currentStage).toBe("first_reply");
  });
});

// ── markWon ────────────────────────────────────────────────────────────────

describe("markWon", () => {
  it("currentStage が won になる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markWon(deal.id);
    expect(updated?.currentStage).toBe("won");
  });

  it("wonAt がセットされる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markWon(deal.id);
    expect(updated?.wonAt).toBeDefined();
  });

  it("probabilityPct = 100", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markWon(deal.id);
    expect(updated?.probabilityPct).toBe(100);
  });

  it("contractAmountJpy で金額を上書きできる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markWon(deal.id, 4_500_000);
    expect(updated?.expectedAmountJpy).toBe(4_500_000);
  });

  it("存在しないIDは null を返す", () => {
    expect(markWon("nonexistent")).toBeNull();
  });
});

// ── markLost ───────────────────────────────────────────────────────────────

describe("markLost", () => {
  it("currentStage が lost になる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markLost(deal.id, "price");
    expect(updated?.currentStage).toBe("lost");
  });

  it("lostAt がセットされる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markLost(deal.id, "competitor");
    expect(updated?.lostAt).toBeDefined();
  });

  it("lossReason がセットされる", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markLost(deal.id, "schedule");
    expect(updated?.lossReason).toBe("schedule");
  });

  it("probabilityPct = 0", () => {
    const deal = intakeFromInquiry(makeInquiry());
    const updated = markLost(deal.id, "other");
    expect(updated?.probabilityPct).toBe(0);
  });

  it("存在しないIDは null を返す", () => {
    expect(markLost("nonexistent", "price")).toBeNull();
  });
});

// ── currentSnapshot ────────────────────────────────────────────────────────

describe("currentSnapshot", () => {
  it("PipelineSnapshot を返す", () => {
    const snap = currentSnapshot();
    expect(snap).toBeDefined();
    expect(typeof snap.totalDeals).toBe("number");
    expect(typeof snap.weightedPipelineJpy).toBe("number");
    expect(Array.isArray(snap.stalledDeals)).toBe(true);
    expect(Array.isArray(snap.riskAlerts)).toBe(true);
  });

  it("intake 後に totalDeals が増える", () => {
    intakeFromInquiry(makeInquiry({ id: "inq-snap-001" }));
    const snap = currentSnapshot();
    expect(snap.totalDeals).toBe(1);
  });
});

// ── riskAlerts ─────────────────────────────────────────────────────────────

describe("riskAlerts", () => {
  it("RiskAlert[] を返す", () => {
    const alerts = riskAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });
});

// ── Full flow ──────────────────────────────────────────────────────────────

describe("Full pipeline flow", () => {
  it("inquiry → first_reply → site_survey → proposal → contract → won", () => {
    const deal = intakeFromInquiry(makeInquiry({ id: "inq-flow-001" }));
    expect(deal.currentStage).toBe("inquiry");

    const t1 = transitionDeal(deal.id, "first_reply");
    expect(t1?.currentStage).toBe("first_reply");

    const t2 = transitionDeal(deal.id, "site_survey");
    expect(t2?.currentStage).toBe("site_survey");

    const t3 = transitionDeal(deal.id, "proposal");
    expect(t3?.currentStage).toBe("proposal");

    const t4 = transitionDeal(deal.id, "contract");
    expect(t4?.currentStage).toBe("contract");

    const won = markWon(deal.id, 5_000_000);
    expect(won?.currentStage).toBe("won");
    expect(won?.wonAt).toBeDefined();
    expect(won?.stageHistory).toHaveLength(5);
  });

  it("inquiry → lost (失注フロー)", () => {
    const deal = intakeFromInquiry(makeInquiry({ id: "inq-lost-001" }));
    const lost = markLost(deal.id, "price");
    expect(lost?.currentStage).toBe("lost");
    expect(lost?.lossReason).toBe("price");
  });
});
