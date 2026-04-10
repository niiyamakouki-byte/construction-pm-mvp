import { describe, expect, it } from "vitest";
import type { Project, Task } from "../domain/types.js";
import {
  buildDailyReportHtml,
  buildWeeklyReportHtml,
  buildProjectReportHtml,
} from "./report-generator.js";

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
