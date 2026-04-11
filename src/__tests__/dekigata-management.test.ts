/**
 * 出来形管理モジュール テスト
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  clearRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  getRecordsByProject,
  getRecordsByCategory,
  checkTolerance,
  getDekigataStats,
  buildDekigataReportHtml,
  MLIT_TEMPLATES,
  type DekigataRecord,
} from "../lib/dekigata-management.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

let _idCounter = 0;
function makeRecord(
  overrides: Partial<Omit<DekigataRecord, "status">> = {},
): DekigataRecord {
  const id = overrides.id ?? `rec-${++_idCounter}`;
  return createRecord({
    id,
    projectId: overrides.projectId ?? "proj-1",
    category: overrides.category ?? "基礎",
    itemName: overrides.itemName ?? "根入れ深さ",
    designValue: overrides.designValue ?? 500,
    actualValue: overrides.actualValue !== undefined ? overrides.actualValue : 510,
    tolerance: overrides.tolerance ?? 50,
    unit: overrides.unit ?? "mm",
    measuredAt: overrides.measuredAt ?? "2026-04-11",
    measuredBy: overrides.measuredBy ?? "田中",
    photoIds: overrides.photoIds ?? [],
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("出来形管理モジュール", () => {
  beforeEach(() => {
    clearRecords();
    _idCounter = 0;
  });

  // ── CRUD: 作成 ──────────────────────────────────────────────────────────────

  it("createRecord: レコードが作成されステータスが自動判定される（pass）", () => {
    const rec = makeRecord({ designValue: 500, actualValue: 520, tolerance: 50 });
    expect(rec.id).toBeTruthy();
    expect(rec.status).toBe("pass");
  });

  it("createRecord: 許容差超過でfailになる", () => {
    const rec = makeRecord({ designValue: 500, actualValue: 600, tolerance: 50 });
    expect(rec.status).toBe("fail");
  });

  it("createRecord: actualValueがnullでpendingになる", () => {
    const rec = makeRecord({ actualValue: null, measuredAt: null, measuredBy: null });
    expect(rec.status).toBe("pending");
  });

  // ── CRUD: 更新 ──────────────────────────────────────────────────────────────

  it("updateRecord: 実測値を更新するとステータスが再判定される", () => {
    const rec = makeRecord({ actualValue: null, measuredAt: null, measuredBy: null });
    expect(rec.status).toBe("pending");

    const updated = updateRecord(rec.id, {
      actualValue: 510,
      measuredAt: "2026-04-11",
      measuredBy: "佐藤",
    });
    expect(updated.actualValue).toBe(510);
    expect(updated.status).toBe("pass");
  });

  it("updateRecord: 存在しないIDはエラーをthrowする", () => {
    expect(() => updateRecord("non-existent", { itemName: "test" })).toThrow();
  });

  // ── CRUD: 削除 ──────────────────────────────────────────────────────────────

  it("deleteRecord: レコードが削除される", () => {
    const rec = makeRecord();
    deleteRecord(rec.id);
    const results = getRecordsByProject("proj-1");
    expect(results).toHaveLength(0);
  });

  it("deleteRecord: 存在しないIDはエラーをthrowする", () => {
    expect(() => deleteRecord("non-existent")).toThrow();
  });

  // ── CRUD: 取得 ──────────────────────────────────────────────────────────────

  it("getRecordsByProject: 指定プロジェクトのレコードのみ返す", () => {
    makeRecord({ id: "r1", projectId: "proj-1" });
    makeRecord({ id: "r2", projectId: "proj-1" });
    makeRecord({ id: "r3", projectId: "proj-2" });

    const proj1 = getRecordsByProject("proj-1");
    expect(proj1).toHaveLength(2);
    expect(proj1.every((r) => r.projectId === "proj-1")).toBe(true);
  });

  it("getRecordsByCategory: 指定カテゴリのレコードのみ返す", () => {
    makeRecord({ id: "r1", category: "基礎" });
    makeRecord({ id: "r2", category: "躯体" });
    makeRecord({ id: "r3", category: "基礎" });

    const kisoRecords = getRecordsByCategory("proj-1", "基礎");
    expect(kisoRecords).toHaveLength(2);
    expect(kisoRecords.every((r) => r.category === "基礎")).toBe(true);
  });

  // ── 許容差判定 ──────────────────────────────────────────────────────────────

  it("checkTolerance: actualValueがnullでpendingを返す", () => {
    const rec: DekigataRecord = {
      id: "x",
      projectId: "p",
      category: "基礎",
      itemName: "test",
      designValue: 100,
      actualValue: null,
      tolerance: 10,
      unit: "mm",
      measuredAt: null,
      measuredBy: null,
      status: "pending",
      photoIds: [],
    };
    expect(checkTolerance(rec)).toBe("pending");
  });

  it("checkTolerance: 許容差内ならpass", () => {
    const rec: DekigataRecord = {
      id: "x",
      projectId: "p",
      category: "基礎",
      itemName: "test",
      designValue: 100,
      actualValue: 105,
      tolerance: 10,
      unit: "mm",
      measuredAt: "2026-04-11",
      measuredBy: "田中",
      status: "pass",
      photoIds: [],
    };
    expect(checkTolerance(rec)).toBe("pass");
  });

  it("checkTolerance: 許容差ちょうどでpass（境界値）", () => {
    const rec: DekigataRecord = {
      id: "x",
      projectId: "p",
      category: "基礎",
      itemName: "test",
      designValue: 100,
      actualValue: 110,
      tolerance: 10,
      unit: "mm",
      measuredAt: "2026-04-11",
      measuredBy: "田中",
      status: "pass",
      photoIds: [],
    };
    expect(checkTolerance(rec)).toBe("pass");
  });

  it("checkTolerance: 許容差超過でfail", () => {
    const rec: DekigataRecord = {
      id: "x",
      projectId: "p",
      category: "基礎",
      itemName: "test",
      designValue: 100,
      actualValue: 111,
      tolerance: 10,
      unit: "mm",
      measuredAt: "2026-04-11",
      measuredBy: "田中",
      status: "fail",
      photoIds: [],
    };
    expect(checkTolerance(rec)).toBe("fail");
  });

  // ── 統計 ────────────────────────────────────────────────────────────────────

  it("getDekigataStats: pass/fail/pending件数とpassRateが正しい", () => {
    makeRecord({ id: "s1", designValue: 500, actualValue: 510, tolerance: 50 }); // pass
    makeRecord({ id: "s2", designValue: 500, actualValue: 600, tolerance: 50 }); // fail
    makeRecord({ id: "s3", actualValue: null, measuredAt: null, measuredBy: null }); // pending

    const stats = getDekigataStats("proj-1");
    expect(stats.pass).toBe(1);
    expect(stats.fail).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.total).toBe(3);
    expect(stats.passRate).toBe(50); // 1/(1+1)*100
  });

  it("getDekigataStats: 計測データなし(pending only)でpassRateは0", () => {
    makeRecord({ actualValue: null, measuredAt: null, measuredBy: null });
    const stats = getDekigataStats("proj-1");
    expect(stats.passRate).toBe(0);
  });

  // ── 帳票HTML生成 ─────────────────────────────────────────────────────────────

  it("buildDekigataReportHtml: HTMLが生成され現場名が含まれる", () => {
    makeRecord({ category: "基礎" });
    const html = buildDekigataReportHtml("proj-1", "KDX南青山");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("KDX南青山");
    expect(html).toContain("出来形管理表");
  });

  it("buildDekigataReportHtml: 合格・不合格件数が帳票に反映される", () => {
    makeRecord({ id: "h1", designValue: 500, actualValue: 510, tolerance: 50 }); // pass
    makeRecord({ id: "h2", designValue: 500, actualValue: 600, tolerance: 50 }); // fail
    const html = buildDekigataReportHtml("proj-1", "テスト現場");
    expect(html).toContain("合格");
    expect(html).toContain("不合格");
    expect(html).toContain("1件"); // pass count
    expect(html).toContain("50.0%"); // passRate
  });

  it("buildDekigataReportHtml: データなし時もHTMLが返る", () => {
    const html = buildDekigataReportHtml("proj-empty", "空現場");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("計測データなし");
  });

  // ── テンプレート ─────────────────────────────────────────────────────────────

  it("MLIT_TEMPLATES: 基礎/躯体/仕上の標準テンプレートが存在する", () => {
    const categories = new Set(MLIT_TEMPLATES.map((t) => t.category));
    expect(categories.has("基礎")).toBe(true);
    expect(categories.has("躯体")).toBe(true);
    expect(categories.has("仕上")).toBe(true);
  });

  it("MLIT_TEMPLATES: 各テンプレートに必須フィールドが揃っている", () => {
    for (const tpl of MLIT_TEMPLATES) {
      expect(tpl.itemName).toBeTruthy();
      expect(tpl.defaultTolerance).toBeGreaterThan(0);
      expect(["mm", "m", "度", "%"]).toContain(tpl.unit);
    }
  });
});
