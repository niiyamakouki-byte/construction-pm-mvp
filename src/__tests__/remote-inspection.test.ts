/**
 * Remote Inspection モジュール テスト
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  clearRemoteInspectionData,
  createCapturePoint,
  createInspectionRoute,
  scheduleInspection,
  startInspection,
  addFinding,
  completeInspection,
  resolveFindings,
  compareProgress,
  getUnresolvedFindings,
  generateInspectionReport,
  buildInspectionReportHtml,
  exportFindingsCSV,
  getInspectionStats,
  suggestInspectionFrequency,
  type CapturePoint,
  type RemoteInspection,
} from "../lib/remote-inspection.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makePoint(overrides: Partial<{ location: string; floor: number; room: string }> = {}): CapturePoint {
  return createCapturePoint(
    "proj-1",
    overrides.location ?? "玄関ホール",
    overrides.floor ?? 1,
    { x: 100, y: 200 },
    overrides.room,
  );
}

function makeInspection(route?: ReturnType<typeof createInspectionRoute>): RemoteInspection {
  const p1 = makePoint({ location: "廊下A" });
  const p2 = makePoint({ location: "会議室B" });
  const r = route ?? createInspectionRoute("proj-1", "定期巡回ルート", [p1.id, p2.id]);
  return scheduleInspection("proj-1", r.id, "我妻", new Date("2026-04-15T09:00:00"));
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("Remote Inspection モジュール", () => {
  beforeEach(() => {
    clearRemoteInspectionData();
  });

  // ── createCapturePoint ────────────────────────────────────────────────────

  describe("createCapturePoint", () => {
    it("必須フィールドが正しく設定される", () => {
      const p = makePoint();
      expect(p.id).toBeTruthy();
      expect(p.projectId).toBe("proj-1");
      expect(p.location).toBe("玄関ホール");
      expect(p.floor).toBe(1);
      expect(p.tags).toEqual([]);
    });

    it("room が任意で設定できる", () => {
      const p = makePoint({ room: "応接室" });
      expect(p.room).toBe("応接室");
    });

    it("capturedAt が Date 型", () => {
      const p = makePoint();
      expect(p.capturedAt).toBeInstanceOf(Date);
    });

    it("position が正しく保存される", () => {
      const p = createCapturePoint("proj-1", "廊下", 2, { x: 50, y: 75 });
      expect(p.position).toEqual({ x: 50, y: 75 });
    });
  });

  // ── createInspectionRoute ─────────────────────────────────────────────────

  describe("createInspectionRoute", () => {
    it("ルートが作成されポイントが順序通り並ぶ", () => {
      const p1 = makePoint({ location: "A" });
      const p2 = makePoint({ location: "B" });
      const route = createInspectionRoute("proj-1", "テストルート", [p1.id, p2.id]);
      expect(route.points).toHaveLength(2);
      expect(route.points[0].location).toBe("A");
      expect(route.points[1].location).toBe("B");
    });

    it("存在しないポイントIDでエラー", () => {
      expect(() =>
        createInspectionRoute("proj-1", "ルート", ["nonexistent-id"]),
      ).toThrow("CapturePoint nonexistent-id not found");
    });

    it("createdAt が Date 型", () => {
      const p = makePoint();
      const route = createInspectionRoute("proj-1", "R", [p.id]);
      expect(route.createdAt).toBeInstanceOf(Date);
    });
  });

  // ── scheduleInspection ────────────────────────────────────────────────────

  describe("scheduleInspection", () => {
    it("初期ステータスは scheduled", () => {
      const insp = makeInspection();
      expect(insp.status).toBe("scheduled");
    });

    it("findings が空配列", () => {
      const insp = makeInspection();
      expect(insp.findings).toEqual([]);
    });

    it("存在しないルートIDでエラー", () => {
      expect(() =>
        scheduleInspection("proj-1", "no-such-route", "検査員", new Date()),
      ).toThrow("InspectionRoute no-such-route not found");
    });
  });

  // ── startInspection ───────────────────────────────────────────────────────

  describe("startInspection", () => {
    it("scheduled → in_progress に遷移", () => {
      const insp = makeInspection();
      const started = startInspection(insp);
      expect(started.status).toBe("in_progress");
    });

    it("in_progress 以外から開始するとエラー", () => {
      const insp = makeInspection();
      const started = startInspection(insp);
      expect(() => startInspection(started)).toThrow();
    });
  });

  // ── addFinding ────────────────────────────────────────────────────────────

  describe("addFinding", () => {
    it("指摘が追加される", () => {
      const insp = makeInspection();
      const started = startInspection(insp);
      const updated = addFinding(started, started.route.points[0].id, "major", "壁", "クロス剥がれ");
      expect(updated.findings).toHaveLength(1);
      expect(updated.findings[0].severity).toBe("major");
      expect(updated.findings[0].status).toBe("open");
    });

    it("複数指摘を追加できる", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "critical", "構造", "亀裂発見");
      insp = addFinding(insp, insp.route.points[0].id, "minor", "仕上", "汚れ");
      expect(insp.findings).toHaveLength(2);
    });

    it("指摘にIDが付与される", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "observation", "照明", "輝度不足");
      expect(insp.findings[0].id).toBeTruthy();
    });
  });

  // ── completeInspection ────────────────────────────────────────────────────

  describe("completeInspection", () => {
    it("in_progress → completed に遷移", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      const completed = completeInspection(insp);
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it("scheduled から完了しようとするとエラー", () => {
      const insp = makeInspection();
      expect(() => completeInspection(insp)).toThrow();
    });
  });

  // ── resolveFindings ───────────────────────────────────────────────────────

  describe("resolveFindings", () => {
    it("指定IDの指摘を解決済みにする", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "major", "壁", "剥がれ");
      const fid = insp.findings[0].id;
      const resolved = resolveFindings(insp, [fid]);
      expect(resolved.findings[0].status).toBe("resolved");
    });

    it("指定外の指摘は変更されない", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "minor", "床", "傷");
      insp = addFinding(insp, insp.route.points[0].id, "major", "壁", "亀裂");
      const fid = insp.findings[0].id;
      const resolved = resolveFindings(insp, [fid]);
      expect(resolved.findings[0].status).toBe("resolved");
      expect(resolved.findings[1].status).toBe("open");
    });
  });

  // ── compareProgress ───────────────────────────────────────────────────────

  describe("compareProgress", () => {
    it("同一場所の複数ポイントで変化検知", () => {
      const base = new Date("2026-03-01");
      const later = new Date("2026-04-01");
      const p1 = createCapturePoint("proj-1", "廊下A", 1, { x: 0, y: 0 });
      const p2 = createCapturePoint("proj-1", "廊下A", 1, { x: 0, y: 0 });
      // Manually set capturedAt for comparison
      (p1 as { capturedAt: Date }).capturedAt = base;
      (p2 as { capturedAt: Date }).capturedAt = later;

      const results = compareProgress([p1, p2]);
      const found = results.find((r) => r.location === "廊下A");
      expect(found?.changeDetected).toBe(true);
    });

    it("1ポイントのみでは変化検知なし", () => {
      const p = makePoint({ location: "廊下B" });
      const results = compareProgress([p]);
      const found = results.find((r) => r.location === "廊下B");
      expect(found?.changeDetected).toBe(false);
    });

    it("dateRange で絞り込みができる", () => {
      const p1 = createCapturePoint("proj-1", "廊下C", 1, { x: 0, y: 0 });
      const p2 = createCapturePoint("proj-1", "廊下C", 1, { x: 0, y: 0 });
      (p1 as { capturedAt: Date }).capturedAt = new Date("2026-01-01");
      (p2 as { capturedAt: Date }).capturedAt = new Date("2026-04-01");
      const results = compareProgress([p1, p2], {
        from: new Date("2026-03-01"),
        to: new Date("2026-04-30"),
      });
      const found = results.find((r) => r.location === "廊下C");
      // Only p2 is in range, so 1 capture → no change
      expect(found?.captures).toHaveLength(1);
      expect(found?.changeDetected).toBe(false);
    });
  });

  // ── getUnresolvedFindings ─────────────────────────────────────────────────

  describe("getUnresolvedFindings", () => {
    it("未解決指摘のみ返す", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "major", "壁", "剥がれ");
      insp = addFinding(insp, insp.route.points[0].id, "minor", "床", "傷");
      const fid = insp.findings[0].id;
      insp = resolveFindings(insp, [fid]);

      const unresolved = getUnresolvedFindings([insp]);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].status).toBe("open");
    });

    it("複数検査を横断して集計", () => {
      let insp1 = makeInspection();
      insp1 = startInspection(insp1);
      insp1 = addFinding(insp1, insp1.route.points[0].id, "major", "A", "issue1");

      const p = makePoint({ location: "別の場所" });
      const route2 = createInspectionRoute("proj-1", "ルート2", [p.id]);
      let insp2 = scheduleInspection("proj-1", route2.id, "鈴木", new Date());
      insp2 = startInspection(insp2);
      insp2 = addFinding(insp2, insp2.route.points[0].id, "minor", "B", "issue2");

      const unresolved = getUnresolvedFindings([insp1, insp2]);
      expect(unresolved).toHaveLength(2);
    });
  });

  // ── generateInspectionReport ──────────────────────────────────────────────

  describe("generateInspectionReport", () => {
    it("サマリーが正しく集計される", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "critical", "構造", "重大亀裂");
      insp = addFinding(insp, insp.route.points[0].id, "minor", "仕上", "軽微な傷");
      const fid = insp.findings[1].id;
      insp = resolveFindings(insp, [fid]);

      const report = generateInspectionReport(insp);
      expect(report.summary.totalPoints).toBe(2);
      expect(report.summary.findingsCount).toBe(2);
      expect(report.summary.criticalCount).toBe(1);
      expect(report.summary.resolvedCount).toBe(1);
    });

    it("progressComparisons が返る", () => {
      const insp = makeInspection();
      const report = generateInspectionReport(insp);
      expect(Array.isArray(report.progressComparisons)).toBe(true);
    });
  });

  // ── buildInspectionReportHtml ─────────────────────────────────────────────

  describe("buildInspectionReportHtml", () => {
    it("有効なHTMLが返る", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "major", "壁", "剥がれ");
      const report = generateInspectionReport(insp);
      const html = buildInspectionReportHtml(report);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("リモート検査レポート");
    });

    it("XSS対策: 特殊文字がエスケープされる", () => {
      const p = makePoint({ location: "<script>alert(1)</script>" });
      const route = createInspectionRoute("proj-1", "<b>Test</b>", [p.id]);
      const insp = scheduleInspection("proj-1", route.id, "検査員<>", new Date());
      const report = generateInspectionReport(insp);
      const html = buildInspectionReportHtml(report);
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("指摘なしでも正常にHTMLが生成される", () => {
      const insp = makeInspection();
      const report = generateInspectionReport(insp);
      const html = buildInspectionReportHtml(report);
      expect(html).toContain("指摘なし");
    });
  });

  // ── exportFindingsCSV ─────────────────────────────────────────────────────

  describe("exportFindingsCSV", () => {
    it("ヘッダー行が含まれる", () => {
      const csv = exportFindingsCSV([]);
      expect(csv).toContain("ID,ポイントID,重要度,カテゴリ,内容,ステータス");
    });

    it("指摘が正しくCSV化される", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "major", "壁仕上", "クロス剥がれ");
      const csv = exportFindingsCSV(insp.findings);
      expect(csv).toContain("重要");
      expect(csv).toContain("壁仕上");
      expect(csv).toContain("クロス剥がれ");
      expect(csv).toContain("未解決");
    });

    it("カンマを含む文字列がクォートされる", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "minor", "床,壁", "問題あり");
      const csv = exportFindingsCSV(insp.findings);
      expect(csv).toContain('"床,壁"');
    });
  });

  // ── getInspectionStats ────────────────────────────────────────────────────

  describe("getInspectionStats", () => {
    it("空配列で全ゼロ", () => {
      const stats = getInspectionStats([]);
      expect(stats.total).toBe(0);
      expect(stats.totalFindings).toBe(0);
      expect(stats.averageFindingsPerInspection).toBe(0);
    });

    it("ステータス別集計が正しい", () => {
      const insp1 = makeInspection();
      const p = makePoint({ location: "別室" });
      const route2 = createInspectionRoute("proj-1", "ルート2", [p.id]);
      let insp2 = scheduleInspection("proj-1", route2.id, "鈴木", new Date());
      insp2 = startInspection(insp2);

      const stats = getInspectionStats([insp1, insp2]);
      expect(stats.total).toBe(2);
      expect(stats.byStatus.scheduled).toBe(1);
      expect(stats.byStatus.in_progress).toBe(1);
    });

    it("平均指摘件数が正しく計算される", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "minor", "A", "1");
      insp = addFinding(insp, insp.route.points[0].id, "minor", "B", "2");

      const stats = getInspectionStats([insp]);
      expect(stats.averageFindingsPerInspection).toBe(2);
    });

    it("critical指摘が正しく集計される", () => {
      let insp = makeInspection();
      insp = startInspection(insp);
      insp = addFinding(insp, insp.route.points[0].id, "critical", "構造", "重大");
      insp = addFinding(insp, insp.route.points[0].id, "major", "壁", "中程度");

      const stats = getInspectionStats([insp]);
      expect(stats.criticalFindings).toBe(1);
    });
  });

  // ── suggestInspectionFrequency ────────────────────────────────────────────

  describe("suggestInspectionFrequency", () => {
    it("解体工事は3日おき", () => {
      const s = suggestInspectionFrequency(60, "解体工事");
      expect(s.frequencyDays).toBe(3);
    });

    it("仕上工程は7日おき", () => {
      const s = suggestInspectionFrequency(60, "内装仕上");
      expect(s.frequencyDays).toBe(7);
    });

    it("竣工前は2日おき", () => {
      const s = suggestInspectionFrequency(60, "竣工検査");
      expect(s.frequencyDays).toBe(2);
    });

    it("残14日以内は高頻度", () => {
      const s = suggestInspectionFrequency(10, "標準工程");
      expect(s.frequencyDays).toBe(2);
    });

    it("残30日以内は中頻度", () => {
      const s = suggestInspectionFrequency(25, "標準工程");
      expect(s.frequencyDays).toBe(5);
    });

    it("余裕あり標準は10日おき", () => {
      const s = suggestInspectionFrequency(90, "標準工程");
      expect(s.frequencyDays).toBe(10);
    });

    it("reason と phase が返る", () => {
      const s = suggestInspectionFrequency(60, "躯体工事");
      expect(s.reason).toBeTruthy();
      expect(s.phase).toBe("躯体工事");
    });
  });
});
