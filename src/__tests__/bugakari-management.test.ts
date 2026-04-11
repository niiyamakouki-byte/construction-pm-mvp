/**
 * 歩掛管理モジュール テスト
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  clearRecords,
  createRecord,
  updateRecord,
  getRecordsByProject,
  getRecordsByCategory,
  getVariance,
  getProjectBugakariSummary,
  buildBugakariReportHtml,
  INTERIOR_BUGAKARI_TEMPLATES,
  type BugakariRecord,
} from "../lib/bugakari-management.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function makeRecord(
  overrides: Partial<Omit<BugakariRecord, "plannedCost" | "actualCost">> = {},
): BugakariRecord {
  const id = overrides.id ?? `bug-${++_idCounter}`;
  return createRecord({
    id,
    projectId: overrides.projectId ?? "proj-1",
    taskName: overrides.taskName ?? "クロス貼り（壁）",
    category: overrides.category ?? "仕上",
    plannedManDays: overrides.plannedManDays ?? 2.0,
    actualManDays: overrides.actualManDays !== undefined ? overrides.actualManDays : 2.0,
    unitPrice: overrides.unitPrice ?? 20000,
    workers: overrides.workers ?? ["田中"],
    startDate: overrides.startDate ?? "2026-04-10",
    endDate: overrides.endDate ?? "2026-04-11",
    note: overrides.note ?? "",
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("歩掛管理モジュール", () => {
  beforeEach(() => {
    clearRecords();
    _idCounter = 0;
  });

  // ── CRUD: 作成 ──────────────────────────────────────────────────────────────

  it("createRecord: レコードが作成されplannedCostが自動計算される", () => {
    const rec = makeRecord({ plannedManDays: 3.0, unitPrice: 20000 });
    expect(rec.id).toBeTruthy();
    expect(rec.plannedCost).toBe(60000);
    expect(rec.actualCost).toBe(40000); // default actualManDays=2.0 * 20000 overridden by makeRecord default
  });

  it("createRecord: plannedCost = plannedManDays * unitPrice", () => {
    const rec = makeRecord({ plannedManDays: 5.0, actualManDays: 5.0, unitPrice: 25000 });
    expect(rec.plannedCost).toBe(125000);
    expect(rec.actualCost).toBe(125000);
  });

  it("createRecord: actualManDaysがnullのときactualCostもnull", () => {
    const rec = makeRecord({ plannedManDays: 2.0, actualManDays: null });
    expect(rec.actualManDays).toBeNull();
    expect(rec.actualCost).toBeNull();
  });

  // ── CRUD: 更新 ──────────────────────────────────────────────────────────────

  it("updateRecord: actualManDaysを更新するとactualCostが再計算される", () => {
    const rec = makeRecord({ plannedManDays: 2.0, actualManDays: null, unitPrice: 20000 });
    expect(rec.actualCost).toBeNull();

    const updated = updateRecord(rec.id, { actualManDays: 3.0 });
    expect(updated.actualManDays).toBe(3.0);
    expect(updated.actualCost).toBe(60000);
  });

  it("updateRecord: 存在しないidはエラー", () => {
    expect(() => updateRecord("no-such-id", { note: "test" })).toThrow();
  });

  // ── 取得 ────────────────────────────────────────────────────────────────────

  it("getRecordsByProject: 同プロジェクトのレコードのみ返す", () => {
    makeRecord({ projectId: "proj-1" });
    makeRecord({ projectId: "proj-1" });
    makeRecord({ projectId: "proj-2" });
    expect(getRecordsByProject("proj-1")).toHaveLength(2);
    expect(getRecordsByProject("proj-2")).toHaveLength(1);
  });

  it("getRecordsByCategory: カテゴリでフィルタリングされる", () => {
    makeRecord({ category: "仕上" });
    makeRecord({ category: "仕上" });
    makeRecord({ category: "解体" });
    expect(getRecordsByCategory("proj-1", "仕上")).toHaveLength(2);
    expect(getRecordsByCategory("proj-1", "解体")).toHaveLength(1);
    expect(getRecordsByCategory("proj-1", "下地")).toHaveLength(0);
  });

  // ── 差分分析 ────────────────────────────────────────────────────────────────

  it("getVariance: 計画超過（実績 > 計画）", () => {
    const rec = makeRecord({ plannedManDays: 2.0, actualManDays: 3.0, unitPrice: 20000 });
    const v = getVariance(rec);
    expect(v).not.toBeNull();
    expect(v!.manDaysDiff).toBe(1.0);
    expect(v!.costDiff).toBe(20000);
    expect(v!.varianceRate).toBe(50);
  });

  it("getVariance: 計画未満（実績 < 計画）", () => {
    const rec = makeRecord({ plannedManDays: 4.0, actualManDays: 3.0, unitPrice: 20000 });
    const v = getVariance(rec);
    expect(v).not.toBeNull();
    expect(v!.manDaysDiff).toBe(-1.0);
    expect(v!.costDiff).toBe(-20000);
    expect(v!.varianceRate).toBe(-25);
  });

  it("getVariance: ぴったり（差分ゼロ）", () => {
    const rec = makeRecord({ plannedManDays: 2.0, actualManDays: 2.0, unitPrice: 20000 });
    const v = getVariance(rec);
    expect(v).not.toBeNull();
    expect(v!.manDaysDiff).toBe(0);
    expect(v!.costDiff).toBe(0);
    expect(v!.varianceRate).toBe(0);
  });

  it("getVariance: actualManDaysがnullのときnullを返す", () => {
    const rec = makeRecord({ actualManDays: null });
    expect(getVariance(rec)).toBeNull();
  });

  // ── 集計 ────────────────────────────────────────────────────────────────────

  it("getProjectBugakariSummary: 計画合計・実績合計・差異率が正しい", () => {
    makeRecord({ plannedManDays: 2.0, actualManDays: 3.0, unitPrice: 20000 }); // +1
    makeRecord({ plannedManDays: 3.0, actualManDays: 3.0, unitPrice: 20000 }); // 0
    makeRecord({ plannedManDays: 1.0, actualManDays: null, unitPrice: 20000 }); // 未完

    const summary = getProjectBugakariSummary("proj-1");
    expect(summary.recordCount).toBe(3);
    expect(summary.completedCount).toBe(2);
    expect(summary.totalPlannedManDays).toBe(6.0);
    expect(summary.totalActualManDays).toBe(6.0);
    expect(summary.totalPlannedCost).toBe(120000);
    // 完了分: planned=5, actual=6 → variance = (6-5)/5 * 100 = 20
    expect(summary.overallVarianceRate).toBe(20);
  });

  // ── テンプレート ─────────────────────────────────────────────────────────────

  it("INTERIOR_BUGAKARI_TEMPLATES: クロス貼り・塗装・フローリング等が含まれる", () => {
    const names = INTERIOR_BUGAKARI_TEMPLATES.map((t) => t.taskName);
    expect(names).toContain("クロス貼り（壁）");
    expect(names).toContain("塗装（EP）");
    expect(names).toContain("フローリング施工");
    expect(names).toContain("軽鉄下地（壁）");
    expect(names).toContain("石膏ボード貼り（壁）");
  });

  it("INTERIOR_BUGAKARI_TEMPLATES: 全テンプレートにstandardManDaysPerUnitが定義される", () => {
    for (const t of INTERIOR_BUGAKARI_TEMPLATES) {
      expect(t.standardManDaysPerUnit).toBeGreaterThan(0);
    }
  });

  // ── 帳票HTML ─────────────────────────────────────────────────────────────────

  it("buildBugakariReportHtml: データなしでも有効なHTMLが返る", () => {
    const html = buildBugakariReportHtml("empty-proj", "空プロジェクト");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("歩掛管理表");
    expect(html).toContain("空プロジェクト");
    expect(html).toContain("データなし");
  });

  it("buildBugakariReportHtml: レコードありで帳票に作業名・人工・原価が含まれる", () => {
    makeRecord({ taskName: "クロス貼り（壁）", plannedManDays: 2.0, actualManDays: 3.0, unitPrice: 20000 });
    const html = buildBugakariReportHtml("proj-1", "テスト現場");
    expect(html).toContain("テスト現場");
    expect(html).toContain("クロス貼り（壁）");
    expect(html).toContain("¥20,000");
    expect(html).toContain("¥40,000"); // plannedCost
    expect(html).toContain("¥60,000"); // actualCost
  });
});
