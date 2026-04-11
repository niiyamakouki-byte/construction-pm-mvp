import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportHtml,
  type MonthlyReportData,
} from "../lib/report-generator.js";

const PROJECT = { name: "南青山内装工事", budget: 5_000_000 };
const PROJECT_ID = "proj-001";

describe("buildMonthlyReportHtml — 基本HTML生成", () => {
  it("タイトルに現場名と対象月が含まれる", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html).toContain("南青山内装工事");
    expect(html).toContain("2024年4月");
  });

  it("<!DOCTYPE html> から始まる有効なHTML文書", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("</html>");
  });

  it("月間サマリーの各指標が出力される", () => {
    const data: MonthlyReportData = {
      progressStart: 20,
      progressEnd: 55,
      completedTasks: 12,
      photoCount: 40,
      correctiveCount: 3,
      workDays: 18,
    };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, data);
    expect(html).toContain("20%");
    expect(html).toContain("55%");
    expect(html).toContain("12 件");
    expect(html).toContain("40 枚");
    expect(html).toContain("3 件");
    expect(html).toContain("18 日");
  });

  it("主要イベントリストが出力される", () => {
    const data: MonthlyReportData = {
      majorEvents: ["下地工事完了", "中間検査合格"],
    };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, data);
    expect(html).toContain("下地工事完了");
    expect(html).toContain("中間検査合格");
  });

  it("翌月の予定リストが出力される", () => {
    const data: MonthlyReportData = {
      nextMonthPlan: ["仕上げ塗装", "竣工検査"],
    };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, data);
    expect(html).toContain("仕上げ塗装");
    expect(html).toContain("竣工検査");
  });
});

describe("buildMonthlyReportHtml — データ欠損時のデフォルト", () => {
  it("空オブジェクトを渡してもエラーなく出力される", () => {
    expect(() =>
      buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {}),
    ).not.toThrow();
  });

  it("majorEvents未指定時は「特記事項なし」が表示される", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html).toContain("特記事項なし");
  });

  it("nextMonthPlan未指定時は「未定」が表示される", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html).toContain("未定");
  });

  it("overview未指定時は「記載なし」が表示される", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html).toContain("記載なし");
  });
});

describe("buildMonthlyReportHtml — XSSエスケープ", () => {
  it("現場名の<script>タグがエスケープされる", () => {
    const malicious = { name: '<script>alert("xss")</script>' };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, malicious, {});
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("majorEventsの<img>タグがエスケープされる", () => {
    const data: MonthlyReportData = {
      majorEvents: ['<img src=x onerror="alert(1)">'],
    };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, data);
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img");
  });

  it("overviewの引用符がエスケープされる", () => {
    const data: MonthlyReportData = { overview: '"test" & \'value\'' };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, data);
    expect(html).toContain("&quot;test&quot;");
    expect(html).toContain("&amp;");
  });

  it("nextMonthPlanのアンパサンドがエスケープされる", () => {
    const data: MonthlyReportData = {
      nextMonthPlan: ["A & B 工事"],
    };
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, data);
    expect(html).not.toContain("A & B");
    expect(html).toContain("A &amp; B");
  });
});

describe("buildMonthlyReportHtml — 印刷用CSS", () => {
  it("A4縦の@pageルールを含む", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html).toContain("A4 portrait");
  });

  it("@media printブロックを含む", () => {
    const html = buildMonthlyReportHtml(PROJECT_ID, 2024, 4, PROJECT, {});
    expect(html).toContain("@media print");
  });
});
