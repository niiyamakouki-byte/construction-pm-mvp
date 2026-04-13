import { describe, expect, it } from "vitest";
import type { Project, Task } from "../domain/types.js";
import {
  buildDailyReportHtml,
  buildWeeklyReportHtml,
  buildProjectReportHtml,
  buildInspectionReportHtml,
  buildConstructionPlanHtml,
  type ConstructionPlanData,
} from "./report-generator.js";
import { createDefaultChecklist } from "./safety-inspection.js";

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "南青山リノベ",
    description: "内装工事",
    status: "active",
    startDate: "2025-01-01",
    budget: 10_000_000,
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
  return {
    projectId: "proj-1",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── buildDailyReportHtml ──────────────────────────────────────────────────

describe("buildDailyReportHtml", () => {
  it("returns valid HTML with doctype and title", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("作業日報");
    expect(html).toContain("南青山リノベ");
    expect(html).toContain("2025-01-07");
  });

  it("includes weather", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07", weather: "晴れ" });
    expect(html).toContain("晴れ");
  });

  it("defaults to 未記入 when weather omitted", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07" });
    expect(html).toContain("未記入");
  });

  it("includes task rows", () => {
    const tasks = [
      makeTask({ id: "t1", name: "塗装工事", startDate: "2025-01-05", dueDate: "2025-01-10", status: "in_progress", progress: 50 }),
    ];
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07", tasks });
    expect(html).toContain("塗装工事");
    expect(html).toContain("50%");
  });

  it("shows 写真なし when no photos", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07" });
    expect(html).toContain("写真なし");
  });

  it("includes photo img tags", () => {
    const html = buildDailyReportHtml({
      project: makeProject(),
      date: "2025-01-07",
      photoUrls: ["https://example.com/photo.jpg"],
    });
    expect(html).toContain("https://example.com/photo.jpg");
  });

  it("includes safety notes", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07", safetyNotes: "KY実施済み" });
    expect(html).toContain("KY実施済み");
  });

  it("includes issues", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07", issues: ["騒音クレーム"] });
    expect(html).toContain("騒音クレーム");
  });

  it("escapes HTML in project name", () => {
    const xss = makeProject({ name: '<script>alert(1)</script>' });
    const html = buildDailyReportHtml({ project: xss, date: "2025-01-07" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("includes entry records when provided", () => {
    const entryRecords = [
      {
        id: "e1",
        projectId: "proj-1",
        workerName: "田中一郎",
        company: "電気工事",
        entryTime: "2025-01-07T08:00:00.000Z",
        exitTime: "2025-01-07T17:00:00.000Z",
      },
    ];
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07", entryRecords });
    expect(html).toContain("田中一郎");
    expect(html).toContain("電気工事");
  });

  it("includes print media query", () => {
    const html = buildDailyReportHtml({ project: makeProject(), date: "2025-01-07" });
    expect(html).toContain("@media print");
  });
});

// ── buildWeeklyReportHtml ─────────────────────────────────────────────────

describe("buildWeeklyReportHtml", () => {
  it("returns valid HTML with weekly title", () => {
    const html = buildWeeklyReportHtml({ project: makeProject(), startDate: "2025-01-06" });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("週報");
    expect(html).toContain("南青山リノベ");
    expect(html).toContain("2025-01-06");
  });

  it("shows end date 6 days after startDate", () => {
    const html = buildWeeklyReportHtml({ project: makeProject(), startDate: "2025-01-06" });
    expect(html).toContain("2025-01-12");
  });

  it("shows progress summary", () => {
    const tasks = [
      makeTask({ id: "t1", name: "基礎工事", status: "done", progress: 100 }),
      makeTask({ id: "t2", name: "内装", status: "in_progress", progress: 50 }),
    ];
    const html = buildWeeklyReportHtml({ project: makeProject(), startDate: "2025-01-06", tasks });
    expect(html).toContain("75%"); // avg progress
  });

  it("shows completed task count", () => {
    const tasks = [
      makeTask({ id: "t1", name: "A", status: "done", progress: 100 }),
      makeTask({ id: "t2", name: "B", status: "todo", progress: 0 }),
    ];
    const html = buildWeeklyReportHtml({ project: makeProject(), startDate: "2025-01-06", tasks });
    expect(html).toContain("1 / 2");
  });

  it("includes forecast section when tasks present", () => {
    const tasks = [makeTask({ id: "t1", name: "塗装", status: "in_progress", progress: 50 })];
    const html = buildWeeklyReportHtml({ project: makeProject(), startDate: "2025-01-06", tasks });
    expect(html).toContain("コスト予測");
  });

  it("escapes HTML in project name", () => {
    const xss = makeProject({ name: '<script>alert(1)</script>' });
    const html = buildWeeklyReportHtml({ project: xss, startDate: "2025-01-06" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ── buildProjectReportHtml ────────────────────────────────────────────────

describe("buildProjectReportHtml", () => {
  it("returns valid HTML with project title", () => {
    const html = buildProjectReportHtml({ project: makeProject() });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("プロジェクト報告書");
    expect(html).toContain("南青山リノベ");
  });

  it("includes health score section", () => {
    const tasks = [
      makeTask({ id: "t1", name: "基礎", status: "done", progress: 100, startDate: "2025-01-01", dueDate: "2025-01-10" }),
    ];
    const html = buildProjectReportHtml({ project: makeProject(), tasks });
    expect(html).toContain("健全性スコア");
    expect(html).toContain("/ 100");
  });

  it("includes EVM section", () => {
    const html = buildProjectReportHtml({ project: makeProject() });
    expect(html).toContain("EVM指標");
    expect(html).toContain("SPI");
    expect(html).toContain("CPI");
  });

  it("includes cost section with budget", () => {
    const html = buildProjectReportHtml({ project: makeProject() });
    expect(html).toContain("コスト概要");
    expect(html).toContain("¥10,000,000");
  });

  it("includes risk section", () => {
    const html = buildProjectReportHtml({ project: makeProject() });
    expect(html).toContain("リスク評価");
  });

  it("includes recommendations section", () => {
    const html = buildProjectReportHtml({ project: makeProject() });
    expect(html).toContain("推奨アクション");
  });

  it("escapes HTML in project name", () => {
    const xss = makeProject({ name: '<b>xss</b>' });
    const html = buildProjectReportHtml({ project: xss });
    expect(html).not.toContain("<b>xss</b>");
    expect(html).toContain("&lt;b&gt;xss&lt;/b&gt;");
  });

  it("handles project with no tasks or expenses", () => {
    const html = buildProjectReportHtml({ project: makeProject(), tasks: [], expenses: [] });
    expect(html).toContain("プロジェクト報告書");
  });
});

// ── buildInspectionReportHtml ─────────────────────────────────────────────

describe("buildInspectionReportHtml", () => {
  function makeChecklist() {
    const partial = createDefaultChecklist("general");
    return {
      ...partial,
      id: "chk-1",
      projectId: "proj-1",
      inspectedBy: "山田太郎",
      date: "2025-03-10",
    };
  }

  it("returns valid HTML with inspection data", () => {
    const checklist = makeChecklist();
    const html = buildInspectionReportHtml({ checklist });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Safety Inspection Report");
  });

  it("includes corrective actions section when provided", () => {
    const checklist = makeChecklist();
    const html = buildInspectionReportHtml({
      checklist,
      correctiveActions: ["fall-protection: ガードレール設置 — 未完了", "ppe: ヘルメット着用確認"],
    });
    expect(html).toContain("是正項目");
    expect(html).toContain("fall-protection");
  });

  it("includes photo section when photoUrls provided", () => {
    const checklist = makeChecklist();
    const html = buildInspectionReportHtml({
      checklist,
      photoUrls: ["https://example.com/photo1.jpg"],
    });
    expect(html).toContain("添付写真");
    expect(html).toContain("https://example.com/photo1.jpg");
  });

  it("returns base HTML unchanged when no extras provided", () => {
    const checklist = makeChecklist();
    const html = buildInspectionReportHtml({ checklist });
    expect(html).not.toContain("是正項目");
    expect(html).not.toContain("添付写真");
  });

  it("escapes HTML in corrective action text", () => {
    const checklist = makeChecklist();
    const html = buildInspectionReportHtml({
      checklist,
      correctiveActions: ["<script>alert(1)</script>"],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ── buildConstructionPlanHtml ─────────────────────────────────────────────

describe("buildConstructionPlanHtml", () => {
  function makePlanData(overrides?: Partial<ConstructionPlanData>): ConstructionPlanData {
    return {
      projectName: "南青山オフィス内装工事",
      contractor: "株式会社ラポルタ",
      client: "株式会社テスト商事",
      constructionPeriod: "2025年4月1日〜2025年6月30日",
      workScope: "オフィス内装工事一式（床・壁・天井・電気設備）",
      safetyMeasures: ["KY活動の実施（毎朝）", "安全帯着用徹底", "墜落防止対策"],
      qualityPlan: "社内品質基準に基づく各工程検査を実施する。",
      schedule: "第1フェーズ: 解体・下地工事（4月）、第2フェーズ: 仕上げ工事（5〜6月）",
      environmentalMeasures: ["廃材の分別回収", "騒音・振動の低減対策"],
      emergencyContacts: [
        { name: "新山光輝", role: "現場責任者", phone: "090-0000-0001" },
        { name: "安全管理係", role: "安全担当", phone: "090-0000-0002" },
      ],
      ...overrides,
    };
  }

  it("returns valid HTML with doctype and 施工計画書 title", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("施工計画書");
    expect(html).toContain("南青山オフィス内装工事");
  });

  it("includes all seven required sections", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("1. 工事概要");
    expect(html).toContain("2. 施工体制");
    expect(html).toContain("3. 工程計画");
    expect(html).toContain("4. 品質管理計画");
    expect(html).toContain("5. 安全管理計画");
    expect(html).toContain("6. 環境対策");
    expect(html).toContain("7. 緊急時対応");
  });

  it("renders header table with contractor, client, and constructionPeriod", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("株式会社ラポルタ");
    expect(html).toContain("株式会社テスト商事");
    expect(html).toContain("2025年4月1日〜2025年6月30日");
  });

  it("renders safety measures as list items", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("KY活動の実施（毎朝）");
    expect(html).toContain("安全帯着用徹底");
    expect(html).toContain("墜落防止対策");
  });

  it("renders environmental measures as list items", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("廃材の分別回収");
    expect(html).toContain("騒音・振動の低減対策");
  });

  it("renders emergency contacts table with name, role, and phone", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("新山光輝");
    expect(html).toContain("現場責任者");
    expect(html).toContain("090-0000-0001");
    expect(html).toContain("安全担当");
  });

  it("shows 登録なし when emergencyContacts is empty", () => {
    const html = buildConstructionPlanHtml(makePlanData({ emergencyContacts: [] }));
    expect(html).toContain("登録なし");
  });

  it("includes A4 portrait print CSS", () => {
    const html = buildConstructionPlanHtml(makePlanData());
    expect(html).toContain("A4 portrait");
    expect(html).toContain("@media print");
  });

  it("escapes HTML in project name", () => {
    const html = buildConstructionPlanHtml(makePlanData({ projectName: "<script>xss</script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in safety measures", () => {
    const html = buildConstructionPlanHtml(makePlanData({ safetyMeasures: ['<img src=x onerror="alert(1)">'] }));
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
