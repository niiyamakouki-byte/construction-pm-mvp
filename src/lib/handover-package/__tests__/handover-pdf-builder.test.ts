/**
 * handover-pdf-builder unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  renderMarkdown,
  renderHtml,
  renderPdfData,
  renderHandoverPackage,
  buildDocumentChecklist,
} from "../handover-pdf-builder.js";
import type { HandoverPackage } from "../types.js";
import { makeHandoverPackageId } from "../types.js";

function makePackage(overrides: Partial<HandoverPackage> = {}): HandoverPackage {
  return {
    id: makeHandoverPackageId("hp-test"),
    projectId: "proj-001",
    ownerName: "山田太郎",
    completedAt: "2025-01-01T00:00:00.000Z",
    status: "documents_collected",
    documents: [
      {
        id: "doc-1",
        kind: "equipment_manual",
        titleJa: "エアコン取扱説明書",
        contentJa: "設備名: エアコン\nメーカー: ダイキン",
      },
      {
        id: "doc-2",
        kind: "warranty_certificate",
        titleJa: "エアコン保証書",
        expiresAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "doc-3",
        kind: "aftercare_contact",
        titleJa: "アフターサービス連絡先一覧",
        contentJa: "電話: 03-XXXX-XXXX",
      },
    ],
    maintenanceSchedule: [
      {
        intervalMonths: 1,
        descriptionJa: "1ヶ月点検",
        scheduledAt: "2025-02-01T00:00:00.000Z",
      },
      {
        intervalMonths: 12,
        descriptionJa: "1年点検",
        scheduledAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("renderMarkdown", () => {
  it("タイトルが含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("引渡しパッケージ");
  });

  it("施主名が含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("山田太郎");
  });

  it("案件IDが含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("proj-001");
  });

  it("目次が含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("目次");
  });

  it("書類一覧が含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("書類一覧");
    expect(md).toContain("エアコン取扱説明書");
  });

  it("メンテナンスカレンダーが含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("メンテナンスカレンダー");
    expect(md).toContain("1ヶ月点検");
  });

  it("アフターサービス連絡先が含まれる", () => {
    const md = renderMarkdown(makePackage());
    expect(md).toContain("アフターサービス連絡先");
    expect(md).toContain("03-XXXX-XXXX");
  });

  it("引渡し日が含まれる (deliveredAt が設定されている場合)", () => {
    const md = renderMarkdown(makePackage({ deliveredAt: "2025-03-01T00:00:00.000Z" }));
    expect(md).toContain("引渡し日");
  });

  it("保証期限が表示される", () => {
    const md = renderMarkdown(makePackage());
    // Should show expiry date for warranty_certificate
    expect(md).toContain("2026");
  });

  it("メンテナンススケジュールが空の場合のメッセージ", () => {
    const md = renderMarkdown(makePackage({ maintenanceSchedule: [] }));
    expect(md).toContain("未設定");
  });
});

describe("renderHtml", () => {
  it("HTMLドキュメントを返す", () => {
    const html = renderHtml(makePackage());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
  });

  it("施主名がタイトルに含まれる", () => {
    const html = renderHtml(makePackage());
    expect(html).toContain("山田太郎");
  });

  it("#6B8E5A カラーが含まれる", () => {
    const html = renderHtml(makePackage());
    expect(html).toContain("#6B8E5A");
  });

  it("書類タイトルが含まれる", () => {
    const html = renderHtml(makePackage());
    expect(html).toContain("エアコン取扱説明書");
  });
});

describe("renderPdfData", () => {
  it("markdown と同じ内容を返す", () => {
    const pkg = makePackage();
    expect(renderPdfData(pkg)).toBe(renderMarkdown(pkg));
  });
});

describe("renderHandoverPackage", () => {
  it("markdown ターゲットで Markdown を返す", () => {
    const result = renderHandoverPackage(makePackage(), "markdown");
    expect(result).toContain("引渡しパッケージ");
    expect(result).not.toContain("<!DOCTYPE html>");
  });

  it("html ターゲットで HTML を返す", () => {
    const result = renderHandoverPackage(makePackage(), "html");
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("pdf_data ターゲットで Markdown 形式を返す", () => {
    const result = renderHandoverPackage(makePackage(), "pdf_data");
    expect(result).toContain("引渡しパッケージ");
  });
});

describe("buildDocumentChecklist", () => {
  it("全ドキュメントのチェックリストを返す", () => {
    const pkg = makePackage();
    const checklist = buildDocumentChecklist(pkg.documents, new Set());
    expect(checklist).toHaveLength(3);
    expect(checklist.every((item) => !item.checked)).toBe(true);
  });

  it("checkedIds に含まれるIDが checked=true になる", () => {
    const pkg = makePackage();
    const checklist = buildDocumentChecklist(pkg.documents, new Set(["doc-1", "doc-3"]));
    expect(checklist.find((item) => item.doc.id === "doc-1")?.checked).toBe(true);
    expect(checklist.find((item) => item.doc.id === "doc-2")?.checked).toBe(false);
    expect(checklist.find((item) => item.doc.id === "doc-3")?.checked).toBe(true);
  });

  it("空のドキュメント一覧は空配列を返す", () => {
    const checklist = buildDocumentChecklist([], new Set());
    expect(checklist).toHaveLength(0);
  });
});
