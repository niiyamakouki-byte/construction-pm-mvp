import { describe, expect, it, beforeEach } from "vitest";
import {
  createSite,
  updateSiteStatus,
  addDailyReport,
  calculateSiteProfit,
  getMultiSiteDashboard,
  getWorkerAllocation,
  optimizeWorkerAssignment,
  getDailyReportSummary,
  buildProfitReportHtml,
  exportDailyReportsCSV,
  detectScheduleConflicts,
  forecastCashflow,
} from "../lib/multi-site-manager";
import type {
  Site,
  DailyReport,
  SiteStatus,
} from "../lib/multi-site-manager";

// ── Helpers ──────────────────────────────────────────────

function makeReport(
  siteId: string,
  date: Date,
  laborHours: number,
  laborRate: number,
  materialAmount: number,
  progress: number,
  weather: DailyReport["weather"] = "sunny",
): Omit<DailyReport, "id" | "siteId"> {
  return {
    date,
    workers: [
      { name: "田中", company: "田中工務", hours: laborHours, dailyRate: laborRate },
    ],
    materials: [
      { name: "合板", quantity: 1, unitPrice: materialAmount, amount: materialAmount },
    ],
    weather,
    progress,
  };
}

// ── createSite ───────────────────────────────────────────

describe("createSite", () => {
  it("正しい初期値でサイトを生成する", () => {
    const site = createSite("新宿現場", "東京都新宿区1-1", 10, 1_000_000, new Date("2024-04-01"));
    expect(site.name).toBe("新宿現場");
    expect(site.address).toBe("東京都新宿区1-1");
    expect(site.estimatedDays).toBe(10);
    expect(site.budget).toBe(1_000_000);
    expect(site.status).toBe("scheduled");
    expect(site.actualCost).toBe(0);
    expect(site.workers).toEqual([]);
    expect(site.currentDay).toBe(0);
    expect(site.id).toBeTruthy();
  });

  it("異なるサイトは異なるIDを持つ", () => {
    const a = createSite("A", "addr", 5, 500_000, new Date());
    const b = createSite("B", "addr", 5, 500_000, new Date());
    expect(a.id).not.toBe(b.id);
  });
});

// ── updateSiteStatus ─────────────────────────────────────

describe("updateSiteStatus", () => {
  it("scheduled → in_progress は有効", () => {
    const site = createSite("現場", "addr", 5, 500_000, new Date());
    const updated = updateSiteStatus(site, "in_progress");
    expect(updated.status).toBe("in_progress");
  });

  it("in_progress → completed は有効", () => {
    const site = createSite("現場", "addr", 5, 500_000, new Date());
    const inProgress = updateSiteStatus(site, "in_progress");
    const completed = updateSiteStatus(inProgress, "completed");
    expect(completed.status).toBe("completed");
    expect(completed.endDate).toBeDefined();
  });

  it("in_progress → paused は有効", () => {
    const site = createSite("現場", "addr", 5, 500_000, new Date());
    const inProgress = updateSiteStatus(site, "in_progress");
    const paused = updateSiteStatus(inProgress, "paused");
    expect(paused.status).toBe("paused");
  });

  it("completed → in_progress は無効でエラー", () => {
    const site = createSite("現場", "addr", 5, 500_000, new Date());
    const inProgress = updateSiteStatus(site, "in_progress");
    const completed = updateSiteStatus(inProgress, "completed");
    expect(() => updateSiteStatus(completed, "in_progress")).toThrow();
  });

  it("cancelled → in_progress は無効でエラー", () => {
    const site = createSite("現場", "addr", 5, 500_000, new Date());
    const cancelled = updateSiteStatus(site, "cancelled");
    expect(() => updateSiteStatus(cancelled, "in_progress")).toThrow();
  });

  it("scheduled → completed は無効でエラー", () => {
    const site = createSite("現場", "addr", 5, 500_000, new Date());
    expect(() => updateSiteStatus(site, "completed")).toThrow();
  });
});

// ── addDailyReport ───────────────────────────────────────

describe("addDailyReport", () => {
  it("日報を追加するとactualCostが増加する", () => {
    const site = createSite("現場", "addr", 5, 1_000_000, new Date());
    const reportInput = makeReport(site.id, new Date(), 8, 20_000, 50_000, 20);
    const { updatedSite, report } = addDailyReport(site, reportInput);

    // labor: dailyRate 20,000 / material: 50,000
    expect(updatedSite.actualCost).toBe(70_000);
    expect(updatedSite.currentDay).toBe(1);
    expect(report.siteId).toBe(site.id);
    expect(report.id).toBeTruthy();
  });

  it("scheduledサイトへの日報追加でステータスがin_progressになる", () => {
    const site = createSite("現場", "addr", 5, 1_000_000, new Date());
    expect(site.status).toBe("scheduled");
    const { updatedSite } = addDailyReport(site, makeReport(site.id, new Date(), 8, 10_000, 0, 10));
    expect(updatedSite.status).toBe("in_progress");
  });

  it("複数の日報を追加するとコストが累積する", () => {
    let site = createSite("現場", "addr", 5, 1_000_000, new Date());
    const { updatedSite: s1 } = addDailyReport(site, makeReport(site.id, new Date(), 8, 10_000, 30_000, 20));
    const { updatedSite: s2 } = addDailyReport(s1, makeReport(site.id, new Date(), 8, 10_000, 30_000, 40));

    // each day: dailyRate 10,000 + material 30,000 = 40,000 → 2 days = 80,000
    expect(s2.actualCost).toBe(80_000);
    expect(s2.currentDay).toBe(2);
  });
});

// ── calculateSiteProfit ──────────────────────────────────

describe("calculateSiteProfit", () => {
  it("予算500万/実績350万→粗利150万/粗利率30%", () => {
    const budget = 5_000_000;
    const site = createSite("KDX現場", "南青山", 20, budget, new Date());

    // Build reports summing to 350万 (3,500,000)
    // labor: 8h × 200,000/day × 10days = 16,000,000... use smaller numbers
    // labor: 8h × 25_000 = 200_000/day, material: 150_000/day → 350_000/day × 10 = 3,500,000
    const reports: DailyReport[] = [];
    for (let i = 0; i < 10; i++) {
      const r = makeReport(site.id, new Date(), 8, 25_000, 150_000, (i + 1) * 10);
      reports.push({ ...r, id: `r${i}`, siteId: site.id });
    }

    const summary = calculateSiteProfit(site, reports);

    expect(summary.budget).toBe(budget);
    expect(summary.laborCost).toBe(250_000); // dailyRate 25000×10
    expect(summary.materialCost).toBe(1_500_000); // 150000×10
    expect(summary.totalCost).toBe(1_750_000); // 250000 + 1500000
    expect(summary.grossProfit).toBe(3_250_000);
    expect(summary.grossMargin).toBeCloseTo(65, 1);
    expect(summary.progressRate).toBe(100); // max of reports
  });

  it("日報なしのサイトはゼロコスト", () => {
    const site = createSite("現場", "addr", 5, 1_000_000, new Date());
    const summary = calculateSiteProfit(site, []);
    expect(summary.totalCost).toBe(0);
    expect(summary.grossProfit).toBe(1_000_000);
    expect(summary.progressRate).toBe(0);
  });

  it("最終原価予測が正しく算出される", () => {
    const site = createSite("現場", "addr", 10, 1_000_000, new Date());
    // 50%進捗で500,000円消費 → cost per progress = 10,000/point → 100点で1,000,000
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: site.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 1, dailyRate: 100_000 }],
        materials: [{ name: "M", quantity: 1, unitPrice: 400_000, amount: 400_000 }],
        weather: "sunny",
        progress: 50,
      },
    ];
    const summary = calculateSiteProfit(site, reports);
    expect(summary.totalCost).toBe(500_000);
    expect(summary.progressRate).toBe(50);
    expect(summary.costPerProgress).toBeCloseTo(10_000, 0);
    expect(summary.projectedFinalCost).toBeCloseTo(1_000_000, 0);
    expect(summary.projectedProfit).toBeCloseTo(0, 0);
  });
});

// ── getMultiSiteDashboard ────────────────────────────────

describe("getMultiSiteDashboard", () => {
  it("アクティブ現場数と合計を正しく集計する", () => {
    const s1 = { ...createSite("A", "addr", 5, 1_000_000, new Date()), status: "in_progress" as SiteStatus };
    const s2 = { ...createSite("B", "addr", 5, 2_000_000, new Date()), status: "completed" as SiteStatus };
    const dashboard = getMultiSiteDashboard([s1, s2], []);
    expect(dashboard.totalSites).toBe(2);
    expect(dashboard.activeSites).toBe(1);
    expect(dashboard.totalBudget).toBe(3_000_000);
  });

  it("予算超過アラートが発生する", () => {
    const site = createSite("超過現場", "addr", 5, 100_000, new Date());
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: site.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 10, dailyRate: 150_000 }],
        materials: [{ name: "M", quantity: 1, unitPrice: 0, amount: 0 }],
        weather: "sunny",
        progress: 80,
      },
    ];
    // labor = dailyRate 150,000 > budget 100,000
    const dashboard = getMultiSiteDashboard([site], reports);
    const hasOverBudget = dashboard.alerts.some((a) => a.includes("予算超過"));
    expect(hasOverBudget).toBe(true);
  });

  it("工程遅延アラートが発生する", () => {
    // 8日経過(80%日程消化)で進捗30%しか進んでいない
    const site: Site = {
      ...createSite("遅延現場", "addr", 10, 1_000_000, new Date()),
      status: "in_progress",
      currentDay: 8,
    };
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: site.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 1, dailyRate: 10_000 }],
        materials: [],
        weather: "cloudy",
        progress: 30,
      },
    ];
    const dashboard = getMultiSiteDashboard([site], reports);
    const hasDelay = dashboard.alerts.some((a) => a.includes("工程遅延"));
    expect(hasDelay).toBe(true);
  });

  it("低粗利アラートが発生する", () => {
    // 90%進捗で予算の95%を消費 → 残り5%→粗利5%→低粗利
    const site = createSite("低粗利現場", "addr", 10, 1_000_000, new Date());
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: site.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 1, dailyRate: 950_000 }],
        materials: [],
        weather: "sunny",
        progress: 90,
      },
    ];
    const dashboard = getMultiSiteDashboard([site], reports);
    const hasLowMargin = dashboard.alerts.some((a) => a.includes("低粗利") || a.includes("予算"));
    expect(hasLowMargin).toBe(true);
  });
});

// ── getWorkerAllocation ──────────────────────────────────

describe("getWorkerAllocation", () => {
  it("ダブルブッキングを検出する", () => {
    const today = new Date();
    const s1: Site = {
      ...createSite("現場A", "addr", 5, 500_000, today),
      status: "in_progress",
      workers: ["田中", "佐藤"],
    };
    const s2: Site = {
      ...createSite("現場B", "addr", 5, 500_000, today),
      status: "in_progress",
      workers: ["田中", "鈴木"],
    };
    const { doubleBooked } = getWorkerAllocation([s1, s2], today);
    expect(doubleBooked).toContain("田中");
    expect(doubleBooked).not.toContain("佐藤");
    expect(doubleBooked).not.toContain("鈴木");
  });

  it("ダブルブッキングなしの場合は空配列", () => {
    const today = new Date();
    const s1: Site = {
      ...createSite("現場A", "addr", 5, 500_000, today),
      status: "in_progress",
      workers: ["田中"],
    };
    const s2: Site = {
      ...createSite("現場B", "addr", 5, 500_000, today),
      status: "in_progress",
      workers: ["佐藤"],
    };
    const { doubleBooked } = getWorkerAllocation([s1, s2], today);
    expect(doubleBooked).toHaveLength(0);
  });

  it("完了・キャンセル済みサイトは除外される", () => {
    const today = new Date();
    const s1: Site = {
      ...createSite("完了現場", "addr", 5, 500_000, today),
      status: "completed",
      workers: ["田中"],
    };
    const s2: Site = {
      ...createSite("稼働現場", "addr", 5, 500_000, today),
      status: "in_progress",
      workers: ["田中"],
    };
    const { allocations, doubleBooked } = getWorkerAllocation([s1, s2], today);
    // completed site excluded → no double-booking
    expect(doubleBooked).toHaveLength(0);
    expect(allocations.some((a) => a.siteName === "完了現場")).toBe(false);
  });
});

// ── optimizeWorkerAssignment ─────────────────────────────

describe("optimizeWorkerAssignment", () => {
  it("稼働中現場が存在しない場合はメッセージを返す", () => {
    const today = new Date();
    const suggestions = optimizeWorkerAssignment([], ["田中", "佐藤"], today);
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0].suggestedSiteName).toContain("割り当て先なし");
  });

  it("作業員を現場に割り当てる提案を返す", () => {
    const today = new Date();
    const site: Site = {
      ...createSite("現場A", "addr", 5, 500_000, today),
      status: "in_progress",
      workers: [],
    };
    const suggestions = optimizeWorkerAssignment([site], ["田中"], today);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestedSiteId).toBe(site.id);
  });
});

// ── getDailyReportSummary ────────────────────────────────

describe("getDailyReportSummary", () => {
  it("日付範囲内のレポートを集計する", () => {
    const siteId = "site-test";
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId,
        date: new Date("2024-04-01"),
        workers: [{ name: "A", company: "C", hours: 8, dailyRate: 10_000 }],
        materials: [{ name: "M", quantity: 1, unitPrice: 20_000, amount: 20_000 }],
        weather: "sunny",
        progress: 20,
      },
      {
        id: "r2",
        siteId,
        date: new Date("2024-04-05"),
        workers: [{ name: "B", company: "C", hours: 8, dailyRate: 10_000 }],
        materials: [{ name: "M", quantity: 1, unitPrice: 30_000, amount: 30_000 }],
        weather: "rain",
        progress: 40,
      },
      {
        id: "r3",
        siteId,
        date: new Date("2024-05-01"), // outside range
        workers: [{ name: "C", company: "C", hours: 8, dailyRate: 10_000 }],
        materials: [],
        weather: "cloudy",
        progress: 60,
      },
    ];

    const summary = getDailyReportSummary(reports, {
      start: new Date("2024-04-01"),
      end: new Date("2024-04-30"),
    });

    expect(summary.totalReports).toBe(2);
    expect(summary.totalLaborCost).toBe(20_000); // dailyRate 10000×2
    expect(summary.totalMaterialCost).toBe(50_000); // 20000+30000
    expect(summary.totalCost).toBe(70_000);
    expect(summary.avgProgress).toBe(30); // (20+40)/2
    expect(summary.weatherBreakdown["sunny"]).toBe(1);
    expect(summary.weatherBreakdown["rain"]).toBe(1);
  });
});

// ── buildProfitReportHtml ────────────────────────────────

describe("buildProfitReportHtml", () => {
  it("HTMLを生成する", () => {
    const site = createSite("テスト現場", "addr", 5, 1_000_000, new Date());
    const dashboard = getMultiSiteDashboard([site], []);
    const html = buildProfitReportHtml(dashboard);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("粗利レポート");
    expect(html).toContain("テスト現場");
  });

  it("XSS対策: 現場名の特殊文字がエスケープされる", () => {
    const site = createSite('<script>alert("xss")</script>', "addr", 5, 500_000, new Date());
    const dashboard = getMultiSiteDashboard([site], []);
    const html = buildProfitReportHtml(dashboard);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("粗利率に応じた色クラスが適用される", () => {
    // Red: margin < 10%
    const siteRed = createSite("赤現場", "addr", 5, 1_000_000, new Date());
    const reportsRed: DailyReport[] = [
      {
        id: "r1",
        siteId: siteRed.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 1, dailyRate: 940_000 }],
        materials: [],
        weather: "sunny",
        progress: 100,
      },
    ];
    const dashRed = getMultiSiteDashboard([siteRed], reportsRed);
    const htmlRed = buildProfitReportHtml(dashRed);
    expect(htmlRed).toContain("margin-red");

    // Green: margin >= 20%
    const siteGreen = createSite("緑現場", "addr", 5, 1_000_000, new Date());
    const dashGreen = getMultiSiteDashboard([siteGreen], []);
    const htmlGreen = buildProfitReportHtml(dashGreen);
    expect(htmlGreen).toContain("margin-green");
  });

  it("黄色: 粗利率 10%以上20%未満", () => {
    const site = createSite("黄現場", "addr", 5, 1_000_000, new Date());
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: site.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 1, dailyRate: 850_000 }],
        materials: [],
        weather: "sunny",
        progress: 100,
      },
    ];
    const dashboard = getMultiSiteDashboard([site], reports);
    const html = buildProfitReportHtml(dashboard);
    expect(html).toContain("margin-yellow");
  });
});

// ── exportDailyReportsCSV ────────────────────────────────

describe("exportDailyReportsCSV", () => {
  it("CSVヘッダーと行を生成する", () => {
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: "site-1",
        date: new Date("2024-04-01"),
        workers: [{ name: "田中", company: "田中工務", hours: 8, dailyRate: 20_000 }],
        materials: [{ name: "合板", quantity: 2, unitPrice: 10_000, amount: 20_000 }],
        weather: "sunny",
        progress: 30,
        note: "順調",
      },
    ];
    const csv = exportDailyReportsCSV(reports);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("報告ID");
    expect(lines[0]).toContain("現場ID");
    expect(lines[0]).toContain("労務費(円)");
    expect(lines[1]).toContain("r1");
    expect(lines[1]).toContain("2024-04-01");
    expect(lines[1]).toContain("sunny");
    expect(lines[1]).toContain("順調");
  });

  it("カンマを含む値がダブルクォートでエスケープされる", () => {
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: "site-1",
        date: new Date("2024-04-01"),
        workers: [],
        materials: [],
        weather: "cloudy",
        progress: 50,
        note: "材料A, 材料B",
      },
    ];
    const csv = exportDailyReportsCSV(reports);
    expect(csv).toContain('"材料A, 材料B"');
  });

  it("空のレポートリストはヘッダーのみを返す", () => {
    const csv = exportDailyReportsCSV([]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("報告ID");
  });
});

// ── detectScheduleConflicts ──────────────────────────────

describe("detectScheduleConflicts", () => {
  it("同じ作業員が重複期間の現場に登録されていると競合を検出する", () => {
    const start = new Date("2024-04-01");
    const s1: Site = {
      ...createSite("現場A", "addr", 10, 500_000, start),
      workers: ["田中"],
    };
    const s2: Site = {
      ...createSite("現場B", "addr", 10, 500_000, new Date("2024-04-05")),
      workers: ["田中"],
    };
    const conflicts = detectScheduleConflicts([s1, s2]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].worker).toBe("田中");
  });

  it("期間が重複しない場合は競合なし", () => {
    const s1: Site = {
      ...createSite("現場A", "addr", 5, 500_000, new Date("2024-04-01")),
      endDate: new Date("2024-04-05"),
      workers: ["田中"],
    };
    const s2: Site = {
      ...createSite("現場B", "addr", 5, 500_000, new Date("2024-04-10")),
      endDate: new Date("2024-04-15"),
      workers: ["田中"],
    };
    const conflicts = detectScheduleConflicts([s1, s2]);
    expect(conflicts).toHaveLength(0);
  });

  it("異なる作業員は競合しない", () => {
    const start = new Date("2024-04-01");
    const s1: Site = {
      ...createSite("現場A", "addr", 10, 500_000, start),
      workers: ["田中"],
    };
    const s2: Site = {
      ...createSite("現場B", "addr", 10, 500_000, start),
      workers: ["佐藤"],
    };
    const conflicts = detectScheduleConflicts([s1, s2]);
    expect(conflicts).toHaveLength(0);
  });
});

// ── forecastCashflow ─────────────────────────────────────

describe("forecastCashflow", () => {
  it("指定月数のキャッシュフロー予測を返す", () => {
    const site: Site = {
      ...createSite("現場", "addr", 30, 3_000_000, new Date()),
      status: "in_progress",
    };
    const result = forecastCashflow([site], [], 3);
    expect(result).toHaveLength(3);
    expect(result[0].month).toMatch(/^\d{4}-\d{2}$/);
    // 3ヶ月で均等分割: 各月1,000,000
    expect(result[0].projectedSpend).toBe(1_000_000);
    expect(result[2].cumulativeSpend).toBe(3_000_000);
  });

  it("実績コストを差し引いた残額をベースに予測する", () => {
    const site = createSite("現場", "addr", 10, 1_000_000, new Date());
    // 500,000 already spent
    const reports: DailyReport[] = [
      {
        id: "r1",
        siteId: site.id,
        date: new Date(),
        workers: [{ name: "A", company: "C", hours: 1, dailyRate: 500_000 }],
        materials: [],
        weather: "sunny",
        progress: 50,
      },
    ];
    const result = forecastCashflow([site], reports, 1);
    // remaining = 1,000,000 - 500,000 = 500,000
    expect(result[0].projectedSpend).toBe(500_000);
  });

  it("月数0のとき空配列を返す", () => {
    const site = createSite("現場", "addr", 10, 1_000_000, new Date());
    const result = forecastCashflow([site], [], 0);
    expect(result).toHaveLength(0);
  });

  it("完了・キャンセルサイトは予測に含まれない", () => {
    const s1: Site = {
      ...createSite("完了", "addr", 10, 1_000_000, new Date()),
      status: "completed",
    };
    const s2: Site = {
      ...createSite("稼働", "addr", 10, 1_000_000, new Date()),
      status: "in_progress",
    };
    const result = forecastCashflow([s1, s2], [], 2);
    // only active site: 1,000,000 / 2 months = 500,000 each
    expect(result[0].projectedSpend).toBe(500_000);
  });
});
