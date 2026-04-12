/**
 * 是正指示ワークフロー テスト
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  clearCorrections,
  createCorrection,
  notifyAssignee,
  startCorrection,
  submitCorrection,
  approveCorrection,
  rejectCorrection,
  getCorrectionsByProject,
  getCorrectionsByStatus,
  getOverdueCorrections,
  getCorrectionStats,
  buildCorrectionReportHtml,
  getCorrectionsByAssignee,
  buildDamageReportHtml,
  type CorrectionItem,
} from "../lib/correction-workflow.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<Omit<CorrectionItem, "id" | "status" | "createdAt" | "updatedAt" | "comments">> = {}): CorrectionItem {
  return createCorrection({
    projectId: overrides.projectId ?? "proj-1",
    pinId: overrides.pinId,
    title: overrides.title ?? "床タイル浮き",
    description: overrides.description ?? "3Fトイレ前の床タイルが浮いている",
    assignee: overrides.assignee ?? "鈴木",
    reporter: overrides.reporter ?? "我妻",
    photos: overrides.photos ?? {},
    dueDate: overrides.dueDate ?? "2026-04-30",
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("是正指示ワークフロー", () => {
  beforeEach(() => {
    clearCorrections();
  });

  // ── 作成 ────────────────────────────────────────────────────────────────────

  it("createCorrection: 初期ステータスは open", () => {
    const item = makeItem();
    expect(item.status).toBe("open");
    expect(item.id).toBeTruthy();
    expect(item.comments).toEqual([]);
  });

  it("createCorrection: pinId と連携できる", () => {
    const item = makeItem({ pinId: "pin-abc" });
    expect(item.pinId).toBe("pin-abc");
  });

  it("createCorrection: photos は空オブジェクトで初期化できる", () => {
    const item = makeItem({ photos: {} });
    expect(item.photos).toEqual({});
  });

  // ── 状態遷移 happy path ──────────────────────────────────────────────────────

  it("notifyAssignee: open → notified", () => {
    const item = makeItem();
    const next = notifyAssignee(item.id);
    expect(next.status).toBe("notified");
  });

  it("startCorrection: notified → in_progress", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    const next = startCorrection(item.id);
    expect(next.status).toBe("in_progress");
  });

  it("submitCorrection: in_progress → corrected（写真なし）", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    startCorrection(item.id);
    const next = submitCorrection(item.id);
    expect(next.status).toBe("corrected");
  });

  it("submitCorrection: after写真を添付できる", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    startCorrection(item.id);
    const next = submitCorrection(item.id, ["photo-after-1.jpg", "photo-after-2.jpg"]);
    expect(next.status).toBe("corrected");
    expect(next.photos.after).toEqual(["photo-after-1.jpg", "photo-after-2.jpg"]);
  });

  it("approveCorrection: corrected → approved", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    startCorrection(item.id);
    submitCorrection(item.id);
    const next = approveCorrection(item.id);
    expect(next.status).toBe("approved");
  });

  it("全工程 happy path: open→notified→in_progress→corrected→approved", () => {
    const item = makeItem();
    expect(item.status).toBe("open");
    expect(notifyAssignee(item.id).status).toBe("notified");
    expect(startCorrection(item.id).status).toBe("in_progress");
    expect(submitCorrection(item.id).status).toBe("corrected");
    expect(approveCorrection(item.id).status).toBe("approved");
  });

  // ── 却下 ─────────────────────────────────────────────────────────────────────

  it("rejectCorrection: open から却下できる", () => {
    const item = makeItem();
    const next = rejectCorrection(item.id);
    expect(next.status).toBe("rejected");
  });

  it("rejectCorrection: notified から却下できる", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    const next = rejectCorrection(item.id);
    expect(next.status).toBe("rejected");
  });

  it("rejectCorrection: in_progress から却下できる", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    startCorrection(item.id);
    const next = rejectCorrection(item.id);
    expect(next.status).toBe("rejected");
  });

  it("rejectCorrection: corrected から却下できる", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    startCorrection(item.id);
    submitCorrection(item.id);
    const next = rejectCorrection(item.id);
    expect(next.status).toBe("rejected");
  });

  // ── 不正遷移の拒否 ───────────────────────────────────────────────────────────

  it("不正遷移: open → approved は例外を投げる", () => {
    const item = makeItem();
    expect(() => approveCorrection(item.id)).toThrow("ステータス遷移不可");
  });

  it("不正遷移: open → in_progress は例外を投げる", () => {
    const item = makeItem();
    expect(() => startCorrection(item.id)).toThrow("ステータス遷移不可");
  });

  it("不正遷移: approved → rejected は例外を投げる", () => {
    const item = makeItem();
    notifyAssignee(item.id);
    startCorrection(item.id);
    submitCorrection(item.id);
    approveCorrection(item.id);
    expect(() => rejectCorrection(item.id)).toThrow("ステータス遷移不可");
  });

  it("不正遷移: rejected → notified は例外を投げる", () => {
    const item = makeItem();
    rejectCorrection(item.id);
    expect(() => notifyAssignee(item.id)).toThrow("ステータス遷移不可");
  });

  it("存在しないIDは例外を投げる", () => {
    expect(() => notifyAssignee("nonexistent-id")).toThrow("not found");
  });

  // ── 一覧取得・フィルタリング ──────────────────────────────────────────────────

  it("getCorrectionsByProject: プロジェクトIDでフィルタリング", () => {
    makeItem({ projectId: "proj-1" });
    makeItem({ projectId: "proj-1" });
    makeItem({ projectId: "proj-2" });
    expect(getCorrectionsByProject("proj-1")).toHaveLength(2);
    expect(getCorrectionsByProject("proj-2")).toHaveLength(1);
    expect(getCorrectionsByProject("proj-99")).toHaveLength(0);
  });

  it("getCorrectionsByStatus: ステータスでフィルタリング", () => {
    const a = makeItem({ projectId: "proj-1" });
    const b = makeItem({ projectId: "proj-1" });
    notifyAssignee(a.id);
    expect(getCorrectionsByStatus("proj-1", "open")).toHaveLength(1);
    expect(getCorrectionsByStatus("proj-1", "notified")).toHaveLength(1);
    expect(getCorrectionsByStatus("proj-1", "approved")).toHaveLength(0);
    void b; // suppress unused warning
  });

  // ── 期限超過 ─────────────────────────────────────────────────────────────────

  it("getOverdueCorrections: 期日を過ぎた未対応を返す", () => {
    makeItem({ projectId: "proj-1", dueDate: "2026-01-01" }); // 超過
    makeItem({ projectId: "proj-1", dueDate: "2099-12-31" }); // 未来
    const overdue = getOverdueCorrections("proj-1", "2026-04-11");
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.dueDate).toBe("2026-01-01");
  });

  it("getOverdueCorrections: 承認済・却下は含まない", () => {
    const a = makeItem({ projectId: "proj-1", dueDate: "2026-01-01" });
    notifyAssignee(a.id);
    startCorrection(a.id);
    submitCorrection(a.id);
    approveCorrection(a.id); // approved → 除外
    const b = makeItem({ projectId: "proj-1", dueDate: "2026-01-01" });
    rejectCorrection(b.id); // rejected → 除外
    const overdue = getOverdueCorrections("proj-1", "2026-04-11");
    expect(overdue).toHaveLength(0);
  });

  it("getOverdueCorrections: dueDate が空のものは含まない", () => {
    makeItem({ projectId: "proj-1", dueDate: "" });
    const overdue = getOverdueCorrections("proj-1", "2026-04-11");
    expect(overdue).toHaveLength(0);
  });

  // ── 統計 ─────────────────────────────────────────────────────────────────────

  it("getCorrectionStats: 件数を正しく集計する", () => {
    const a = makeItem({ projectId: "proj-s" }); // open
    const b = makeItem({ projectId: "proj-s" }); // notified
    notifyAssignee(b.id);
    const c = makeItem({ projectId: "proj-s" }); // in_progress
    notifyAssignee(c.id);
    startCorrection(c.id);
    const d = makeItem({ projectId: "proj-s" }); // approved
    notifyAssignee(d.id);
    startCorrection(d.id);
    submitCorrection(d.id);
    approveCorrection(d.id);
    const e = makeItem({ projectId: "proj-s" }); // rejected
    rejectCorrection(e.id);
    void a;

    const stats = getCorrectionStats("proj-s");
    expect(stats.open).toBe(2);        // open + notified
    expect(stats.in_progress).toBe(1); // in_progress
    expect(stats.completed).toBe(1);   // approved
    expect(stats.rejected).toBe(1);    // rejected
    expect(stats.total).toBe(5);
  });

  it("getCorrectionStats: データなしは全0", () => {
    const stats = getCorrectionStats("empty-project");
    expect(stats).toEqual({ open: 0, in_progress: 0, completed: 0, rejected: 0, total: 0 });
  });

  // ── 帳票HTML ─────────────────────────────────────────────────────────────────

  it("buildCorrectionReportHtml: HTMLを生成する", () => {
    makeItem({ projectId: "proj-r", title: "壁クロス剥がれ" });
    makeItem({ projectId: "proj-r", title: "床タイル浮き" });
    const html = buildCorrectionReportHtml("proj-r", "KDX南青山ビル");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("KDX南青山ビル");
    expect(html).toContain("2件");
    expect(html).toContain("壁クロス剥がれ");
    expect(html).toContain("床タイル浮き");
  });

  it("buildCorrectionReportHtml: データなしは「是正指示なし」を表示", () => {
    const html = buildCorrectionReportHtml("empty-proj", "テスト現場");
    expect(html).toContain("是正指示なし");
    expect(html).toContain("0件");
  });

  it("buildCorrectionReportHtml: HTMLエスケープが適用される", () => {
    makeItem({ projectId: "proj-xss", title: "<script>alert('xss')</script>" });
    const html = buildCorrectionReportHtml("proj-xss", "<Test>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Test&gt;");
  });

  // ── 業者別グループ化 ──────────────────────────────────────────────────────────

  it("getCorrectionsByAssignee: 業者別にグループ化される", () => {
    makeItem({ projectId: "proj-a", assignee: "山田電気" });
    makeItem({ projectId: "proj-a", assignee: "山田電気" });
    makeItem({ projectId: "proj-a", assignee: "田中内装" });
    const grouped = getCorrectionsByAssignee("proj-a");
    expect(grouped["山田電気"]).toHaveLength(2);
    expect(grouped["田中内装"]).toHaveLength(1);
  });

  it("getCorrectionsByAssignee: 別プロジェクトのデータは含まない", () => {
    makeItem({ projectId: "proj-a", assignee: "山田電気" });
    makeItem({ projectId: "proj-b", assignee: "山田電気" });
    const grouped = getCorrectionsByAssignee("proj-a");
    expect(grouped["山田電気"]).toHaveLength(1);
  });

  it("getCorrectionsByAssignee: データなしは空オブジェクトを返す", () => {
    const grouped = getCorrectionsByAssignee("no-such-project");
    expect(Object.keys(grouped)).toHaveLength(0);
  });

  // ── ダメ帳HTML ────────────────────────────────────────────────────────────────

  it("buildDamageReportHtml: ヘッダー情報（工事名・業者名・発行日・是正期限）を含む", () => {
    makeItem({ projectId: "proj-d", assignee: "田中内装", dueDate: "2026-05-15" });
    const html = buildDamageReportHtml("proj-d", "KDX南青山ビル", "田中内装");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("KDX南青山ビル");
    expect(html).toContain("田中内装");
    expect(html).toContain("2026-05-15");
    expect(html).toContain("発行日");
    expect(html).toContain("是正期限");
  });

  it("buildDamageReportHtml: 指定期限を優先して使用する", () => {
    makeItem({ projectId: "proj-d2", assignee: "田中内装", dueDate: "2026-05-15" });
    const html = buildDamageReportHtml("proj-d2", "テスト現場", "田中内装", "2026-06-30");
    expect(html).toContain("2026-06-30");
    expect(html).not.toContain("2026-05-15");
  });

  it("buildDamageReportHtml: 一覧に指摘内容・場所・ステータス・写真有無・コメント数を含む", () => {
    const item = makeItem({
      projectId: "proj-d3",
      assignee: "山田電気",
      title: "照明スイッチ不具合",
      description: "3F廊下",
      photos: { before: ["before.jpg"] },
    });
    notifyAssignee(item.id);
    startCorrection(item.id);
    const html = buildDamageReportHtml("proj-d3", "テスト現場", "山田電気");
    expect(html).toContain("照明スイッチ不具合");
    expect(html).toContain("3F廊下");
    expect(html).toContain("対応中");
    expect(html).toContain("あり");
    expect(html).toContain("コメント");
  });

  it("buildDamageReportHtml: フッターに未対応/対応中/完了の件数サマリを含む", () => {
    const a = makeItem({ projectId: "proj-d4", assignee: "佐藤設備" }); // open
    const b = makeItem({ projectId: "proj-d4", assignee: "佐藤設備" }); // in_progress
    notifyAssignee(b.id);
    startCorrection(b.id);
    const c = makeItem({ projectId: "proj-d4", assignee: "佐藤設備" }); // approved
    notifyAssignee(c.id);
    startCorrection(c.id);
    submitCorrection(c.id);
    approveCorrection(c.id);
    void a;
    const html = buildDamageReportHtml("proj-d4", "テスト現場", "佐藤設備");
    expect(html).toContain("未対応:");
    expect(html).toContain("対応中:");
    expect(html).toContain("完了:");
    // open=1, in_progress=1, completed=1
    expect(html).toMatch(/未対応:.*1件/s);
    expect(html).toMatch(/対応中:.*1件/s);
    expect(html).toMatch(/完了:.*1件/s);
  });

  it("buildDamageReportHtml: 業者にデータなしは「是正指示なし」を表示", () => {
    makeItem({ projectId: "proj-d5", assignee: "他業者" });
    const html = buildDamageReportHtml("proj-d5", "テスト現場", "存在しない業者");
    expect(html).toContain("是正指示なし");
    expect(html).toContain("未対応:");
  });

  it("buildDamageReportHtml: HTMLエスケープが適用される", () => {
    makeItem({ projectId: "proj-d6", assignee: "<Evil>", title: "<script>hack()</script>" });
    const html = buildDamageReportHtml("proj-d6", "<Proj>", "<Evil>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Evil&gt;");
    expect(html).toContain("&lt;Proj&gt;");
  });
});
