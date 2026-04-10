/**
 * crm-store カオステスト — 異常入力・境界値の網羅
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  addCustomer,
  addDeal,
  getDeal,
  changeStage,
  getPipelineSummary,
  _resetCRMStore,
  type Customer,
  type Deal,
} from "./crm-store.js";

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "田中 太郎",
    company: "田中建設",
    phone: "03-1234-5678",
    email: "tanaka@example.com",
    address: "東京都港区",
    note: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  const now = new Date().toISOString();
  return {
    id: "d1",
    customerId: "c1",
    projectName: "南青山内装工事",
    stage: "引合",
    estimatedAmount: 5000000,
    actualAmount: null,
    probability: 20,
    expectedCloseDate: "2025-06-30",
    note: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("crm-store: カオステスト", () => {
  beforeEach(() => _resetCRMStore());

  // ── 確率の境界値 ──────────────────────────────────────────────────────────

  it("確率0%の商談はweightedAmountが0になる", () => {
    addCustomer(makeCustomer());
    addDeal(makeDeal({ id: "d1", probability: 0, estimatedAmount: 1000000 }));
    const summary = getPipelineSummary();
    const stage = summary.find((s) => s.stage === "引合")!;
    expect(stage.weightedAmount).toBe(0);
  });

  it("確率100%の商談はweightedAmountが見積金額と同じになる", () => {
    addCustomer(makeCustomer());
    addDeal(makeDeal({ id: "d1", probability: 100, estimatedAmount: 2000000 }));
    const summary = getPipelineSummary();
    const stage = summary.find((s) => s.stage === "引合")!;
    expect(stage.weightedAmount).toBeCloseTo(2000000);
  });

  it("確率100超の商談はweightedAmountが見積金額を超える（バリデーション未実装確認）", () => {
    addCustomer(makeCustomer());
    addDeal(makeDeal({ id: "d1", probability: 150, estimatedAmount: 1000000 }));
    const summary = getPipelineSummary();
    const stage = summary.find((s) => s.stage === "引合")!;
    // probability/100 = 1.5 → weightedAmount = 1500000
    expect(stage.weightedAmount).toBeCloseTo(1500000);
  });

  it("確率マイナスの商談はweightedAmountがマイナスになる（バリデーション未実装確認）", () => {
    addCustomer(makeCustomer());
    addDeal(makeDeal({ id: "d1", probability: -10, estimatedAmount: 1000000 }));
    const summary = getPipelineSummary();
    const stage = summary.find((s) => s.stage === "引合")!;
    expect(stage.weightedAmount).toBeLessThan(0);
  });

  // ── 存在しないcustomerIdでのDeal作成 ────────────────────────────────────

  it("存在しないcustomerIdでのDeal作成は登録される（参照整合性チェック未実装確認）", () => {
    // customerを追加せずにdealを追加
    addDeal(makeDeal({ id: "d1", customerId: "nonexistent-customer" }));
    const deal = getDeal("d1");
    // バリデーションがないため、存在しないcustomerIdでも登録される
    expect(deal?.customerId).toBe("nonexistent-customer");
  });

  // ── 同じステージへの遷移 ────────────────────────────────────────────────

  it("同じステージへの遷移は更新される（循環チェック未実装確認）", () => {
    addCustomer(makeCustomer());
    addDeal(makeDeal({ id: "d1", stage: "引合" }));
    const result = changeStage("d1", "引合");
    // 同ステージへの遷移もupdateを通してしまう
    expect(result?.stage).toBe("引合");
  });

  it("ステージを後退させることができる（逆方向遷移チェック未実装確認）", () => {
    addCustomer(makeCustomer());
    addDeal(makeDeal({ id: "d1", stage: "受注" }));
    const result = changeStage("d1", "引合");
    // 逆方向へのステージ変更もバリデーションなく通る
    expect(result?.stage).toBe("引合");
  });
});
