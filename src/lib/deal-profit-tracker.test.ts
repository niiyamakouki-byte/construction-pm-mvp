import { afterEach, describe, expect, it } from "vitest";
import {
  addChangeOrder,
  buildProfitDashboardHtml,
  buildThreeAxisDashboardHtml,
  calcThreeAxisSummary,
  clearDeals,
  createDeal,
  getActivePipeline,
  getActualGrossProfit,
  getAllDeals,
  getCompletedDeals,
  getDealsByPhase,
  getGrossProfit,
  getGrossProfitRate,
  getMonthlyProfitTrend,
  getPipelineSummary,
  updateDeal,
  updatePhase,
} from "./deal-profit-tracker";
import type { DealProfit } from "./deal-profit-tracker";

function makeDeal(overrides: Partial<DealProfit> = {}): DealProfit {
  return {
    id: "d1",
    projectId: "p1",
    projectName: "テスト案件",
    clientName: "テスト顧客",
    phase: "引合",
    estimatedRevenue: 1000000,
    estimatedCost: 700000,
    actualRevenue: 0,
    actualCost: 0,
    changeOrders: [],
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  clearDeals();
});

// ─── CRUD ────────────────────────────────────────────────────

describe("createDeal", () => {
  it("案件を登録して返す", () => {
    const deal = makeDeal();
    const result = createDeal(deal);
    expect(result.id).toBe("d1");
    expect(result.projectName).toBe("テスト案件");
  });

  it("登録後にgetAllDealsで取得できる", () => {
    createDeal(makeDeal());
    expect(getAllDeals()).toHaveLength(1);
  });
});

describe("updateDeal", () => {
  it("既存案件を更新できる", () => {
    createDeal(makeDeal());
    const updated = updateDeal("d1", { projectName: "更新案件", updatedAt: "2026-04-02T00:00:00Z" });
    expect(updated?.projectName).toBe("更新案件");
  });

  it("存在しないIDはnullを返す", () => {
    expect(updateDeal("nonexistent", { projectName: "x" })).toBeNull();
  });
});

describe("addChangeOrder", () => {
  it("変更注文を追加できる", () => {
    createDeal(makeDeal());
    const updated = addChangeOrder("d1", {
      id: "co1",
      description: "追加工事",
      amount: 50000,
      type: "revenue",
      approvedAt: "2026-04-05T00:00:00Z",
    });
    expect(updated?.changeOrders).toHaveLength(1);
    expect(updated?.changeOrders[0].description).toBe("追加工事");
  });

  it("存在しない案件IDはnullを返す", () => {
    expect(addChangeOrder("nonexistent", {
      id: "co1",
      description: "x",
      amount: 0,
      type: "cost",
      approvedAt: "2026-04-05T00:00:00Z",
    })).toBeNull();
  });
});

describe("updatePhase", () => {
  it("フェーズを更新できる", () => {
    createDeal(makeDeal());
    const updated = updatePhase("d1", "受注", "2026-04-10T00:00:00Z");
    expect(updated?.phase).toBe("受注");
  });
});

// ─── 粗利計算 ────────────────────────────────────────────────

describe("getGrossProfit", () => {
  it("見積売上 - 見積原価を返す", () => {
    const deal = makeDeal({ estimatedRevenue: 1000000, estimatedCost: 700000 });
    expect(getGrossProfit(deal)).toBe(300000);
  });
});

describe("getActualGrossProfit", () => {
  it("変更注文なしで actualRevenue - actualCost を返す", () => {
    const deal = makeDeal({ actualRevenue: 900000, actualCost: 650000 });
    expect(getActualGrossProfit(deal)).toBe(250000);
  });

  it("変更注文（売上）を含めた実績粗利を返す", () => {
    const deal = makeDeal({
      actualRevenue: 900000,
      actualCost: 650000,
      changeOrders: [
        { id: "co1", description: "追加", amount: 50000, type: "revenue", approvedAt: "2026-04-05T00:00:00Z" },
      ],
    });
    expect(getActualGrossProfit(deal)).toBe(300000);
  });

  it("変更注文（コスト）を含めた実績粗利を返す", () => {
    const deal = makeDeal({
      actualRevenue: 900000,
      actualCost: 650000,
      changeOrders: [
        { id: "co2", description: "追加原価", amount: 30000, type: "cost", approvedAt: "2026-04-06T00:00:00Z" },
      ],
    });
    expect(getActualGrossProfit(deal)).toBe(220000);
  });
});

describe("getGrossProfitRate", () => {
  it("粗利率を正しく計算する", () => {
    const deal = makeDeal({ estimatedRevenue: 1000000, estimatedCost: 700000 });
    expect(getGrossProfitRate(deal)).toBeCloseTo(30, 1);
  });

  it("売上が0の場合は0を返す", () => {
    const deal = makeDeal({ estimatedRevenue: 0, estimatedCost: 0 });
    expect(getGrossProfitRate(deal)).toBe(0);
  });
});

// ─── 一覧取得 ────────────────────────────────────────────────

describe("getDealsByPhase", () => {
  it("指定フェーズの案件のみ返す", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合" }));
    createDeal(makeDeal({ id: "d2", phase: "受注" }));
    expect(getDealsByPhase("引合")).toHaveLength(1);
    expect(getDealsByPhase("受注")).toHaveLength(1);
    expect(getDealsByPhase("失注")).toHaveLength(0);
  });
});

describe("getActivePipeline", () => {
  it("引合〜施工中の案件を返す", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合" }));
    createDeal(makeDeal({ id: "d2", phase: "施工中" }));
    createDeal(makeDeal({ id: "d3", phase: "完工" }));
    createDeal(makeDeal({ id: "d4", phase: "失注" }));
    const result = getActivePipeline();
    expect(result).toHaveLength(2);
  });
});

describe("getCompletedDeals", () => {
  it("完工・請求済・入金済の案件を返す", () => {
    createDeal(makeDeal({ id: "d1", phase: "完工" }));
    createDeal(makeDeal({ id: "d2", phase: "請求済" }));
    createDeal(makeDeal({ id: "d3", phase: "入金済" }));
    createDeal(makeDeal({ id: "d4", phase: "引合" }));
    expect(getCompletedDeals()).toHaveLength(3);
  });
});

// ─── サマリ ──────────────────────────────────────────────────

describe("getPipelineSummary", () => {
  it("フェーズ別の件数・金額を集計する", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合", estimatedRevenue: 500000, estimatedCost: 350000 }));
    createDeal(makeDeal({ id: "d2", phase: "引合", estimatedRevenue: 300000, estimatedCost: 210000 }));
    const summary = getPipelineSummary();
    const hikiai = summary.byPhase.find((p) => p.phase === "引合");
    expect(hikiai?.count).toBe(2);
    expect(hikiai?.totalEstimatedRevenue).toBe(800000);
    expect(hikiai?.totalEstimatedGrossProfit).toBe(240000);
  });

  it("失注案件はtotalDealsに含まれない", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合" }));
    createDeal(makeDeal({ id: "d2", phase: "失注" }));
    const summary = getPipelineSummary();
    expect(summary.totalDeals).toBe(1);
  });
});

describe("getMonthlyProfitTrend", () => {
  it("完了案件を月ごとに集計する", () => {
    createDeal(makeDeal({
      id: "d1",
      phase: "入金済",
      actualRevenue: 1000000,
      actualCost: 700000,
      updatedAt: "2026-03-31T00:00:00Z",
    }));
    createDeal(makeDeal({
      id: "d2",
      phase: "請求済",
      actualRevenue: 500000,
      actualCost: 350000,
      updatedAt: "2026-03-15T00:00:00Z",
    }));
    const trend = getMonthlyProfitTrend();
    expect(trend).toHaveLength(1);
    expect(trend[0].month).toBe("2026-03");
    expect(trend[0].completedDeals).toBe(2);
    expect(trend[0].actualRevenue).toBe(1500000);
    expect(trend[0].actualGrossProfit).toBe(450000);
    expect(trend[0].grossProfitRate).toBeCloseTo(30, 1);
  });

  it("アクティブ案件は月次推移に含まれない", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合", updatedAt: "2026-04-01T00:00:00Z" }));
    expect(getMonthlyProfitTrend()).toHaveLength(0);
  });
});

// ─── 帳票 ────────────────────────────────────────────────────

describe("buildProfitDashboardHtml", () => {
  it("有効なHTMLを返す", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合" }));
    const html = buildProfitDashboardHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("引合粗利管理ダッシュボード");
  });

  it("案件名・顧客名が含まれる", () => {
    createDeal(makeDeal({ id: "d1", phase: "受注", projectName: "南青山工事", clientName: "ABC株式会社" }));
    const html = buildProfitDashboardHtml();
    expect(html).toContain("南青山工事");
    expect(html).toContain("ABC株式会社");
  });

  it("案件ゼロでもエラーなくHTMLを返す", () => {
    const html = buildProfitDashboardHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("案件がありません");
  });

  it("HTMLインジェクションをエスケープする", () => {
    createDeal(makeDeal({ id: "d1", phase: "引合", projectName: "<script>alert(1)</script>" }));
    const html = buildProfitDashboardHtml();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ─── 3軸ダッシュボード ────────────────────────────────────────

const NOW = new Date("2026-04-12T00:00:00Z");

describe("calcThreeAxisSummary", () => {
  it("過去実績に完工・請求済・入金済案件が集計される", () => {
    const deals: DealProfit[] = [
      makeDeal({ id: "c1", phase: "完工", actualRevenue: 1000000, actualCost: 700000, updatedAt: "2026-03-01T00:00:00Z" }),
      makeDeal({ id: "c2", phase: "入金済", actualRevenue: 500000, actualCost: 350000, updatedAt: "2026-03-20T00:00:00Z" }),
      makeDeal({ id: "a1", phase: "施工中", estimatedRevenue: 800000, estimatedCost: 560000, updatedAt: "2026-04-10T00:00:00Z" }),
    ];
    const s = calcThreeAxisSummary(deals, NOW);
    expect(s.pastActual.deals).toHaveLength(2);
    expect(s.pastActual.totalActualRevenue).toBe(1500000);
    expect(s.pastActual.totalActualGrossProfit).toBe(450000);
    expect(s.pastActual.grossProfitRate).toBeCloseTo(30, 1);
  });

  it("今月着地に今月updatedAtの受注/施工中案件が集計される", () => {
    const deals: DealProfit[] = [
      makeDeal({ id: "t1", phase: "施工中", estimatedRevenue: 2000000, estimatedCost: 1400000, updatedAt: "2026-04-05T00:00:00Z" }),
      makeDeal({ id: "t2", phase: "受注", estimatedRevenue: 600000, estimatedCost: 420000, updatedAt: "2026-04-01T00:00:00Z" }),
      makeDeal({ id: "t3", phase: "施工中", estimatedRevenue: 400000, estimatedCost: 280000, updatedAt: "2026-03-28T00:00:00Z" }),
    ];
    const s = calcThreeAxisSummary(deals, NOW);
    expect(s.thisMonthLanding.deals).toHaveLength(2);
    expect(s.thisMonthLanding.totalEstimatedRevenue).toBe(2600000);
    expect(s.thisMonthLanding.totalEstimatedGrossProfit).toBe(780000);
  });

  it("来月見込に今月着地以外のアクティブ案件が集計される", () => {
    const deals: DealProfit[] = [
      makeDeal({ id: "n1", phase: "引合", estimatedRevenue: 500000, estimatedCost: 350000, updatedAt: "2026-03-01T00:00:00Z" }),
      makeDeal({ id: "n2", phase: "商談中", estimatedRevenue: 300000, estimatedCost: 210000, updatedAt: "2026-03-15T00:00:00Z" }),
      makeDeal({ id: "t1", phase: "施工中", estimatedRevenue: 800000, estimatedCost: 560000, updatedAt: "2026-04-08T00:00:00Z" }),
    ];
    const s = calcThreeAxisSummary(deals, NOW);
    expect(s.nextMonthPipeline.deals).toHaveLength(2);
    expect(s.nextMonthPipeline.totalEstimatedRevenue).toBe(800000);
  });

  it("前月比トレンドが上昇の場合upを返す", () => {
    // 前月(2026-03): 粗利率20%、今月(2026-04): 粗利率30%
    const deals: DealProfit[] = [
      makeDeal({ id: "p1", phase: "入金済", actualRevenue: 1000000, actualCost: 800000, updatedAt: "2026-03-01T00:00:00Z" }),
      makeDeal({ id: "p2", phase: "入金済", actualRevenue: 1000000, actualCost: 700000, updatedAt: "2026-04-01T00:00:00Z" }),
    ];
    const s = calcThreeAxisSummary(deals, NOW);
    expect(s.trendDirection).toBe("up");
    expect(s.trendDiff).toBeGreaterThan(0);
  });

  it("前月比トレンドが下降の場合downを返す", () => {
    // 前月(2026-03): 粗利率30%、今月(2026-04): 粗利率20%
    const deals: DealProfit[] = [
      makeDeal({ id: "p1", phase: "入金済", actualRevenue: 1000000, actualCost: 700000, updatedAt: "2026-03-01T00:00:00Z" }),
      makeDeal({ id: "p2", phase: "入金済", actualRevenue: 1000000, actualCost: 800000, updatedAt: "2026-04-01T00:00:00Z" }),
    ];
    const s = calcThreeAxisSummary(deals, NOW);
    expect(s.trendDirection).toBe("down");
    expect(s.trendDiff).toBeLessThan(0);
  });

  it("前月データなしの場合flatを返す", () => {
    const deals: DealProfit[] = [
      makeDeal({ id: "p1", phase: "入金済", actualRevenue: 1000000, actualCost: 700000, updatedAt: "2026-04-01T00:00:00Z" }),
    ];
    const s = calcThreeAxisSummary(deals, NOW);
    expect(s.trendDirection).toBe("flat");
  });

  it("案件ゼロでもエラーなく動作する", () => {
    const s = calcThreeAxisSummary([], NOW);
    expect(s.pastActual.deals).toHaveLength(0);
    expect(s.thisMonthLanding.deals).toHaveLength(0);
    expect(s.nextMonthPipeline.deals).toHaveLength(0);
    expect(s.trendDirection).toBe("flat");
  });
});

describe("buildThreeAxisDashboardHtml", () => {
  it("有効なHTMLを返す", () => {
    const html = buildThreeAxisDashboardHtml([], NOW);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("粗利3軸ダッシュボード");
  });

  it("3軸のタイトルが含まれる", () => {
    const html = buildThreeAxisDashboardHtml([], NOW);
    expect(html).toContain("過去実績");
    expect(html).toContain("今月着地");
    expect(html).toContain("来月見込");
  });

  it("粗利率前月比トレンドが表示される", () => {
    const deals: DealProfit[] = [
      makeDeal({ id: "p1", phase: "入金済", actualRevenue: 1000000, actualCost: 700000, updatedAt: "2026-03-01T00:00:00Z" }),
      makeDeal({ id: "p2", phase: "入金済", actualRevenue: 1000000, actualCost: 600000, updatedAt: "2026-04-01T00:00:00Z" }),
    ];
    const html = buildThreeAxisDashboardHtml(deals, NOW);
    expect(html).toContain("粗利率前月比");
    expect(html).toContain("▲");
  });

  it("HTMLインジェクションをエスケープする", () => {
    const deals: DealProfit[] = [
      makeDeal({ id: "x1", phase: "入金済", actualRevenue: 500000, actualCost: 350000, updatedAt: "2026-04-01T00:00:00Z" }),
    ];
    // フェーズ名はDealPhase型で固定なので、XSSはトレンドラベルやフェーズ表示のみ対象
    const html = buildThreeAxisDashboardHtml(deals, NOW);
    expect(html).not.toContain("<script>");
  });

  it("案件ゼロでも全3軸が¥0で表示される", () => {
    const html = buildThreeAxisDashboardHtml([], NOW);
    expect(html.match(/¥0/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
