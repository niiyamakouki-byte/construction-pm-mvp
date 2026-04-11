import { afterEach, describe, expect, it } from "vitest";
import {
  buildAnalyticsDashboardHtml,
  clearProjectStore,
  getAlerts,
  getCompanyDashboard,
  getMonthlyTrend,
  getProjectKPIs,
  getRankings,
  setProjectStore,
} from "./project-analytics.js";

afterEach(() => {
  clearProjectStore();
});

const sampleProjects = [
  {
    projectId: "p1",
    projectName: "KDX南青山",
    revenue: 94_600_000,
    cost: 6_100_000,
    completionRate: 60,
    manDaysPlanned: 100,
    manDaysActual: 80,
    photoCount: 50,
    correctionCount: 0,
    safetyIncidents: 0,
  },
  {
    projectId: "p2",
    projectName: "アルペジオ",
    revenue: 5_000_000,
    cost: 4_000_000,
    completionRate: 90,
    manDaysPlanned: 40,
    manDaysActual: 42,
    photoCount: 20,
    correctionCount: 2,
    safetyIncidents: 0,
  },
  {
    projectId: "p3",
    projectName: "墨田区物件",
    revenue: 3_000_000,
    cost: 3_500_000,
    completionRate: 20,
    manDaysPlanned: 30,
    manDaysActual: 35,
    photoCount: 10,
    correctionCount: 1,
    safetyIncidents: 1,
  },
];

// ── KPI計算 ───────────────────────────────────────────

describe("getProjectKPIs", () => {
  it("粗利・粗利率を正しく計算する", () => {
    setProjectStore([sampleProjects[0]]);
    const [kpi] = getProjectKPIs();
    expect(kpi.grossProfit).toBe(94_600_000 - 6_100_000);
    expect(kpi.grossProfitRate).toBeCloseTo(93.55, 1);
  });

  it("粗利がマイナスの場合も正しく計算する", () => {
    setProjectStore([sampleProjects[2]]);
    const [kpi] = getProjectKPIs();
    expect(kpi.grossProfit).toBe(-500_000);
    expect(kpi.grossProfitRate).toBeLessThan(0);
  });

  it("projectIdsで絞り込める", () => {
    setProjectStore(sampleProjects);
    const kpis = getProjectKPIs(["p1", "p3"]);
    expect(kpis).toHaveLength(2);
    expect(kpis.map((k) => k.projectId)).toEqual(["p1", "p3"]);
  });

  it("projectIds空の場合は全件返す", () => {
    setProjectStore(sampleProjects);
    const kpis = getProjectKPIs([]);
    expect(kpis).toHaveLength(3);
  });

  it("省略フィールドはデフォルト0になる", () => {
    setProjectStore([{ projectId: "x", projectName: "テスト", revenue: 1000, cost: 800 }]);
    const [kpi] = getProjectKPIs();
    expect(kpi.completionRate).toBe(0);
    expect(kpi.correctionCount).toBe(0);
    expect(kpi.safetyIncidents).toBe(0);
  });
});

// ── 全社ダッシュボード ────────────────────────────────

describe("getCompanyDashboard", () => {
  it("売上・粗利・原価の合計を計算する", () => {
    setProjectStore(sampleProjects);
    const d = getCompanyDashboard();
    expect(d.totalRevenue).toBe(94_600_000 + 5_000_000 + 3_000_000);
    expect(d.totalCost).toBe(6_100_000 + 4_000_000 + 3_500_000);
    expect(d.totalGrossProfit).toBe(d.totalRevenue - d.totalCost);
  });

  it("案件数と進行中件数を返す", () => {
    setProjectStore(sampleProjects);
    const d = getCompanyDashboard();
    expect(d.projectCount).toBe(3);
    // completionRate < 100 の案件数: p1(60), p2(90), p3(20) = 3件すべて
    expect(d.activeProjectCount).toBe(3);
  });

  it("空ストアでは0を返す", () => {
    const d = getCompanyDashboard();
    expect(d.totalRevenue).toBe(0);
    expect(d.projectCount).toBe(0);
  });
});

// ── 月次推移 ──────────────────────────────────────────

describe("getMonthlyTrend", () => {
  it("指定した月数のデータを返す", () => {
    setProjectStore(sampleProjects);
    const trend = getMonthlyTrend(6);
    expect(trend).toHaveLength(6);
  });

  it("各ポイントにmonth・revenue・grossProfitが含まれる", () => {
    setProjectStore(sampleProjects);
    const trend = getMonthlyTrend(3);
    for (const point of trend) {
      expect(point.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof point.revenue).toBe("number");
      expect(typeof point.grossProfit).toBe("number");
    }
  });

  it("月の合計が全体売上と一致する（均等月割り）", () => {
    setProjectStore(sampleProjects);
    const months = 4;
    const trend = getMonthlyTrend(months);
    const totalRevenue = 94_600_000 + 5_000_000 + 3_000_000;
    const sumRevenue = trend.reduce((s, t) => s + t.revenue, 0);
    // 均等月割りなので合計 ≒ totalRevenue（端数処理の差は許容）
    expect(Math.abs(sumRevenue - totalRevenue)).toBeLessThanOrEqual(months);
  });
});

// ── ランキング ────────────────────────────────────────

describe("getRankings", () => {
  it("粗利率トップN件を降順で返す", () => {
    setProjectStore(sampleProjects);
    const rankings = getRankings("grossProfitRate", 2);
    expect(rankings).toHaveLength(2);
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].projectId).toBe("p1"); // 93%が最高
    expect(rankings[1].value).toBeLessThanOrEqual(rankings[0].value);
  });

  it("売上ランキングを返す", () => {
    setProjectStore(sampleProjects);
    const rankings = getRankings("revenue", 3);
    expect(rankings[0].projectId).toBe("p1");
    expect(rankings[2].projectId).toBe("p3");
  });

  it("limit=1なら1件だけ返す", () => {
    setProjectStore(sampleProjects);
    expect(getRankings("grossProfit", 1)).toHaveLength(1);
  });
});

// ── アラート ──────────────────────────────────────────

describe("getAlerts", () => {
  it("粗利マイナスをcriticalで検知する", () => {
    setProjectStore([sampleProjects[2]]); // 墨田区: 粗利マイナス
    const alerts = getAlerts();
    const profitAlert = alerts.find((a) => a.type === "negative_profit");
    expect(profitAlert).toBeDefined();
    expect(profitAlert?.level).toBe("critical");
  });

  it("安全インシデントをcriticalで検知する", () => {
    setProjectStore([sampleProjects[2]]); // safetyIncidents: 1
    const alerts = getAlerts();
    const safetyAlert = alerts.find((a) => a.type === "safety_incident");
    expect(safetyAlert).toBeDefined();
    expect(safetyAlert?.level).toBe("critical");
  });

  it("是正未対応をwarningで検知する", () => {
    setProjectStore([sampleProjects[1]]); // correctionCount: 2
    const alerts = getAlerts();
    const correctionAlert = alerts.find((a) => a.type === "correction_unresolved");
    expect(correctionAlert).toBeDefined();
    expect(correctionAlert?.level).toBe("warning");
  });

  it("正常な案件ではアラートなし", () => {
    setProjectStore([sampleProjects[0]]); // p1: 問題なし
    const alerts = getAlerts();
    expect(alerts).toHaveLength(0);
  });

  it("複数案件の複数アラートをまとめて返す", () => {
    setProjectStore(sampleProjects);
    const alerts = getAlerts();
    expect(alerts.length).toBeGreaterThan(1);
  });
});

// ── HTML生成 ──────────────────────────────────────────

describe("buildAnalyticsDashboardHtml", () => {
  it("HTMLドキュメントを返す", () => {
    setProjectStore(sampleProjects);
    const html = buildAnalyticsDashboardHtml();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("経営ダッシュボード");
  });

  it("売上合計が含まれる", () => {
    setProjectStore(sampleProjects);
    const html = buildAnalyticsDashboardHtml();
    const totalRevenue = (94_600_000 + 5_000_000 + 3_000_000).toLocaleString();
    expect(html).toContain(totalRevenue);
  });

  it("アラートなしの場合に「異常なし」を表示する", () => {
    setProjectStore([sampleProjects[0]]); // 正常案件のみ
    const html = buildAnalyticsDashboardHtml();
    expect(html).toContain("異常なし");
  });

  it("アラートありの場合にテーブルを含む", () => {
    setProjectStore([sampleProjects[2]]); // 問題あり案件
    const html = buildAnalyticsDashboardHtml();
    expect(html).toContain("<table>");
    expect(html).toContain("墨田区物件");
  });
});
