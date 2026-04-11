/**
 * 資料承認ワークフロー テスト
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  clearDocuments,
  createDocument,
  submitForApproval,
  startReview,
  approve,
  reject,
  revise,
  addDocumentComment,
  getDocumentsByProject,
  getDocumentsByStatus,
  getPendingApprovals,
  getApprovalStats,
  buildApprovalLogHtml,
  type ApprovalDocument,
} from "../lib/document-approval.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<Omit<ApprovalDocument, "id" | "status" | "version" | "comments" | "createdAt" | "updatedAt">> = {}): ApprovalDocument {
  return createDocument({
    projectId: overrides.projectId ?? "proj-1",
    title: overrides.title ?? "1F平面図",
    category: overrides.category ?? "図面",
    submittedBy: overrides.submittedBy ?? "鈴木",
    reviewers: overrides.reviewers ?? ["我妻", "新山"],
  });
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("資料承認ワークフロー", () => {
  beforeEach(() => {
    clearDocuments();
  });

  // ── 作成 ────────────────────────────────────────────────────────────────────

  it("createDocument: 初期ステータスは draft、version は 1", () => {
    const doc = makeDoc();
    expect(doc.status).toBe("draft");
    expect(doc.version).toBe(1);
    expect(doc.id).toBeTruthy();
    expect(doc.comments).toEqual([]);
  });

  it("createDocument: カテゴリを指定できる", () => {
    const doc = makeDoc({ category: "見積書" });
    expect(doc.category).toBe("見積書");
  });

  it("createDocument: reviewers が保存される", () => {
    const doc = makeDoc({ reviewers: ["田中", "山田"] });
    expect(doc.reviewers).toEqual(["田中", "山田"]);
  });

  // ── 状態遷移 happy path ──────────────────────────────────────────────────────

  it("submitForApproval: draft → submitted", () => {
    const doc = makeDoc();
    const next = submitForApproval(doc.id, "鈴木", "提出します");
    expect(next.status).toBe("submitted");
    expect(next.comments).toHaveLength(1);
    expect(next.comments[0]!.action).toBe("submit");
    expect(next.comments[0]!.text).toBe("提出します");
  });

  it("startReview: submitted → reviewing", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    const next = startReview(doc.id, "我妻");
    expect(next.status).toBe("reviewing");
  });

  it("approve: reviewing → approved", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    startReview(doc.id, "我妻");
    const next = approve(doc.id, "我妻", "問題なし");
    expect(next.status).toBe("approved");
    const approveComment = next.comments.find((c) => c.action === "approve");
    expect(approveComment?.text).toBe("問題なし");
  });

  it("全工程 happy path: draft→submitted→reviewing→approved", () => {
    const doc = makeDoc();
    expect(doc.status).toBe("draft");
    expect(submitForApproval(doc.id, "鈴木").status).toBe("submitted");
    expect(startReview(doc.id, "我妻").status).toBe("reviewing");
    expect(approve(doc.id, "我妻").status).toBe("approved");
  });

  // ── 却下 ─────────────────────────────────────────────────────────────────────

  it("reject: submitted から却下できる", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    const next = reject(doc.id, "我妻", "内容不備");
    expect(next.status).toBe("rejected");
    expect(next.comments.find((c) => c.action === "reject")?.text).toBe("内容不備");
  });

  it("reject: reviewing から却下できる", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    startReview(doc.id, "我妻");
    const next = reject(doc.id, "我妻");
    expect(next.status).toBe("rejected");
  });

  // ── 差戻し ───────────────────────────────────────────────────────────────────

  it("revise: reviewing → revised、version がインクリメントされる", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    startReview(doc.id, "我妻");
    const next = revise(doc.id, "我妻", "図面スケールを修正してください");
    expect(next.status).toBe("revised");
    expect(next.version).toBe(2);
    expect(next.comments.find((c) => c.action === "revise")?.text).toBe("図面スケールを修正してください");
  });

  it("差戻し後に再提出できる: revised → submitted", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    startReview(doc.id, "我妻");
    revise(doc.id, "我妻");
    const next = submitForApproval(doc.id, "鈴木", "修正しました");
    expect(next.status).toBe("submitted");
    expect(next.version).toBe(2);
  });

  // ── 不正遷移の拒否 ───────────────────────────────────────────────────────────

  it("不正遷移: draft → approved は例外を投げる", () => {
    const doc = makeDoc();
    expect(() => approve(doc.id, "我妻")).toThrow("ステータス遷移不可");
  });

  it("不正遷移: draft → reviewing は例外を投げる", () => {
    const doc = makeDoc();
    expect(() => startReview(doc.id, "我妻")).toThrow("ステータス遷移不可");
  });

  it("不正遷移: approved → rejected は例外を投げる", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    startReview(doc.id, "我妻");
    approve(doc.id, "我妻");
    expect(() => reject(doc.id, "我妻")).toThrow("ステータス遷移不可");
  });

  it("不正遷移: rejected → submitted は例外を投げる", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    reject(doc.id, "我妻");
    expect(() => submitForApproval(doc.id, "鈴木")).toThrow("ステータス遷移不可");
  });

  it("存在しないIDは例外を投げる", () => {
    expect(() => approve("nonexistent-id", "我妻")).toThrow("not found");
  });

  // ── コメント追加 ─────────────────────────────────────────────────────────────

  it("addDocumentComment: ステータス変更なしでコメントを追加できる", () => {
    const doc = makeDoc();
    submitForApproval(doc.id, "鈴木");
    const next = addDocumentComment(doc.id, "新山", "確認中です");
    expect(next.status).toBe("submitted");
    const comments = next.comments.filter((c) => c.action === "comment");
    expect(comments.some((c) => c.text === "確認中です")).toBe(true);
  });

  // ── 一覧取得・フィルタリング ──────────────────────────────────────────────────

  it("getDocumentsByProject: プロジェクトIDでフィルタリング", () => {
    makeDoc({ projectId: "proj-1" });
    makeDoc({ projectId: "proj-1" });
    makeDoc({ projectId: "proj-2" });
    expect(getDocumentsByProject("proj-1")).toHaveLength(2);
    expect(getDocumentsByProject("proj-2")).toHaveLength(1);
    expect(getDocumentsByProject("proj-99")).toHaveLength(0);
  });

  it("getDocumentsByStatus: ステータスでフィルタリング", () => {
    const a = makeDoc({ projectId: "proj-1" });
    const b = makeDoc({ projectId: "proj-1" });
    submitForApproval(a.id, "鈴木");
    expect(getDocumentsByStatus("proj-1", "draft")).toHaveLength(1);
    expect(getDocumentsByStatus("proj-1", "submitted")).toHaveLength(1);
    expect(getDocumentsByStatus("proj-1", "approved")).toHaveLength(0);
    void b;
  });

  // ── ユーザー別承認待ち ────────────────────────────────────────────────────────

  it("getPendingApprovals: 自分がレビュアーの submitted/reviewing を返す", () => {
    const a = makeDoc({ reviewers: ["我妻", "新山"] });
    submitForApproval(a.id, "鈴木");
    const b = makeDoc({ reviewers: ["我妻"] });
    submitForApproval(b.id, "鈴木");
    startReview(b.id, "我妻");
    const c = makeDoc({ reviewers: ["田中"] }); // 我妻は含まれない
    submitForApproval(c.id, "鈴木");

    const pending = getPendingApprovals("我妻");
    expect(pending).toHaveLength(2);
    expect(pending.map((d) => d.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("getPendingApprovals: 承認済・却下・差戻しは含まない", () => {
    const a = makeDoc({ reviewers: ["我妻"] });
    submitForApproval(a.id, "鈴木");
    startReview(a.id, "我妻");
    approve(a.id, "我妻");

    const b = makeDoc({ reviewers: ["我妻"] });
    submitForApproval(b.id, "鈴木");
    reject(b.id, "我妻");

    expect(getPendingApprovals("我妻")).toHaveLength(0);
  });

  // ── 統計 ─────────────────────────────────────────────────────────────────────

  it("getApprovalStats: 件数を正しく集計する", () => {
    const a = makeDoc({ projectId: "proj-s" }); // draft
    const b = makeDoc({ projectId: "proj-s" }); // submitted
    submitForApproval(b.id, "鈴木");
    const c = makeDoc({ projectId: "proj-s" }); // reviewing
    submitForApproval(c.id, "鈴木");
    startReview(c.id, "我妻");
    const d = makeDoc({ projectId: "proj-s" }); // approved
    submitForApproval(d.id, "鈴木");
    startReview(d.id, "我妻");
    approve(d.id, "我妻");
    const e = makeDoc({ projectId: "proj-s" }); // rejected
    submitForApproval(e.id, "鈴木");
    reject(e.id, "我妻");
    const f = makeDoc({ projectId: "proj-s" }); // revised
    submitForApproval(f.id, "鈴木");
    startReview(f.id, "我妻");
    revise(f.id, "我妻");
    void a;

    const stats = getApprovalStats("proj-s");
    expect(stats.pending).toBe(2);   // submitted + reviewing
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.revised).toBe(1);
    expect(stats.total).toBe(6);
  });

  it("getApprovalStats: データなしは全0", () => {
    const stats = getApprovalStats("empty-project");
    expect(stats).toEqual({ pending: 0, approved: 0, rejected: 0, revised: 0, total: 0 });
  });

  // ── 帳票HTML ─────────────────────────────────────────────────────────────────

  it("buildApprovalLogHtml: HTMLを生成する", () => {
    makeDoc({ projectId: "proj-r", title: "KDX南青山平面図", category: "図面" });
    makeDoc({ projectId: "proj-r", title: "工事見積書", category: "見積書" });
    const html = buildApprovalLogHtml("proj-r", "KDX南青山ビル");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("KDX南青山ビル");
    expect(html).toContain("2件");
    expect(html).toContain("KDX南青山平面図");
    expect(html).toContain("工事見積書");
  });

  it("buildApprovalLogHtml: データなしは「資料なし」を表示", () => {
    const html = buildApprovalLogHtml("empty-proj", "テスト現場");
    expect(html).toContain("資料なし");
    expect(html).toContain("0件");
  });

  it("buildApprovalLogHtml: HTMLエスケープが適用される", () => {
    makeDoc({ projectId: "proj-xss", title: "<script>alert('xss')</script>" });
    const html = buildApprovalLogHtml("proj-xss", "<Test>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;Test&gt;");
  });
});
