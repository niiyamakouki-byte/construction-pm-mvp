/**
 * safety-documents カオステスト — XSS・異常入力・境界値の網羅
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createDocument,
  createFromTemplate,
  copyDocumentToProject,
  generateDocumentHtml,
  listDocuments,
  clearAllDocuments,
  DOCUMENT_TEMPLATE_DATA,
} from "./safety-documents.js";

beforeEach(() => {
  clearAllDocuments();
});

describe("safety-documents: カオステスト", () => {

  // ── XSS攻撃文字列 ────────────────────────────────────────────────────────

  it("titleにXSS文字列を含む場合、HTMLはscriptタグをエスケープする", () => {
    const doc = createDocument({
      projectId: "proj-1",
      type: "作業員名簿",
      title: "<script>alert(1)</script>",
      data: DOCUMENT_TEMPLATE_DATA["作業員名簿"],
    });
    const html = generateDocumentHtml(doc);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("projectIdにXSS文字列を含む場合、HTMLはエスケープする", () => {
    const doc = createDocument({
      projectId: '<img src=x onerror="alert(1)">',
      type: "作業員名簿",
      title: "テスト",
      data: DOCUMENT_TEMPLATE_DATA["作業員名簿"],
    });
    const html = generateDocumentHtml(doc);
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img");
  });

  it("工事安全衛生計画書のprojectNameにXSS文字列が含まれてもHTMLはエスケープする", () => {
    const doc = createDocument({
      projectId: "proj-1",
      type: "工事安全衛生計画書",
      title: "安全計画",
      data: {
        type: "工事安全衛生計画書",
        plan: {
          projectName: "<script>alert('xss')</script>",
          projectManager: "田中",
          safetyOfficer: "鈴木",
          startDate: "2026-04-01",
          endDate: "2026-12-31",
          objectives: ["目標1"],
          measures: ["対策1"],
          emergencyProcedure: "緊急対応手順",
        },
      },
    });
    const html = generateDocumentHtml(doc);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("有資格者一覧の名前にXSS文字列が含まれてもHTMLはエスケープする", () => {
    const doc = createDocument({
      projectId: "proj-1",
      type: "有資格者一覧",
      title: "有資格者一覧",
      data: {
        type: "有資格者一覧",
        workers: [{
          name: '<a href="javascript:void(0)">クリック</a>',
          company: "株式会社A",
          qualification: "危険物取扱者",
          licenseNumber: "12345",
          issueDate: "2020-01-01",
          expiryDate: "2030-01-01",
        }],
      },
    });
    const html = generateDocumentHtml(doc);
    expect(html).not.toContain("<a href=");
    expect(html).toContain("&lt;a");
  });

  // ── 存在しないプロジェクトへのコピー ────────────────────────────────────

  it("存在しないsourceIdからのコピーはundefinedを返す", () => {
    const result = copyDocumentToProject("nonexistent-id", "target-proj");
    expect(result).toBeUndefined();
    expect(listDocuments("target-proj")).toHaveLength(0);
  });

  it("存在するソースを存在しないターゲットプロジェクトIDにコピーする（IDチェックなし確認）", () => {
    const source = createFromTemplate("proj-1", "作業員名簿");
    // 存在しないプロジェクトIDでもコピー可能
    const copy = copyDocumentToProject(source.id, "nonexistent-project-999");
    expect(copy).toBeDefined();
    expect(copy!.projectId).toBe("nonexistent-project-999");
  });

  // ── 空文字列や特殊値 ─────────────────────────────────────────────────────

  it("空文字列のprojectIdで書類を作成できる（バリデーション未実装確認）", () => {
    const doc = createDocument({
      projectId: "",
      type: "作業手順書",
      title: "テスト",
      data: DOCUMENT_TEMPLATE_DATA["作業手順書"],
    });
    expect(doc.projectId).toBe("");
    expect(listDocuments("")).toHaveLength(1);
  });

  it("空文字列のtitleで書類を作成してもHTMLが生成される", () => {
    const doc = createDocument({
      projectId: "proj-1",
      type: "新規入場者教育",
      title: "",
      data: DOCUMENT_TEMPLATE_DATA["新規入場者教育"],
    });
    const html = generateDocumentHtml(doc);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("作業手順書の手順descriptionにXSS文字列が含まれてもHTMLはscriptタグをエスケープする", () => {
    const doc = createDocument({
      projectId: "proj-1",
      type: "作業手順書",
      title: "手順書",
      data: {
        type: "作業手順書",
        procedures: [{
          workTitle: "テスト作業",
          author: "田中",
          date: "2026-04-01",
          steps: [{
            stepNo: 1,
            description: "<script>evil()</script>",
            hazards: "<img src=x onerror=alert(1)>",
            countermeasures: "対策",
          }],
          approvedBy: "鈴木",
        }],
      },
    });
    const html = generateDocumentHtml(doc);
    // scriptタグはエスケープされて実行不可能になる
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // imgタグのonerrorもエスケープされて実行不可能になる
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    // onerrorはHTMLタグ内の属性としてではなく、エスケープされたテキストとして含まれる
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
