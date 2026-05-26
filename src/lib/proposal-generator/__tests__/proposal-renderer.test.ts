/**
 * proposal-renderer unit tests.
 */

import { describe, it, expect } from "vitest";
import { renderMarkdown, renderHtml, renderPdfData } from "../proposal-renderer.js";
import type { ProposalDocument } from "../types.js";

function makeDoc(overrides: Partial<ProposalDocument> = {}): ProposalDocument {
  return {
    id: "prop-render-test",
    customerName: "田中花子",
    generatedAt: "2026-05-09T00:00:00Z",
    sections: [
      {
        kind: "cover",
        titleJa: "ご提案書",
        bodyJa: "田中花子 様\n\nご提案書本文",
        orderIndex: 0,
      },
      {
        kind: "executive_summary",
        titleJa: "ご提案の概要",
        bodyJa: "概要説明文",
        callouts: ["概算: 500万円〜1000万円", "工期: 30日間"],
        orderIndex: 1,
      },
      {
        kind: "price_range",
        titleJa: "概算工事費",
        bodyJa: "価格説明",
        orderIndex: 5,
      },
    ],
    totalPriceJpyLower: 5_000_000,
    totalPriceJpyUpper: 10_000_000,
    durationDays: 30,
    validUntil: "2026-06-08",
    ...overrides,
  };
}

describe("renderMarkdown", () => {
  it("文字列を返す", () => {
    const result = renderMarkdown(makeDoc());
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("顧客名が含まれる", () => {
    const result = renderMarkdown(makeDoc());
    expect(result).toContain("田中花子");
  });

  it("価格レンジが含まれる", () => {
    const result = renderMarkdown(makeDoc());
    expect(result).toContain("500万円");
  });

  it("有効期限が含まれる", () => {
    const result = renderMarkdown(makeDoc());
    expect(result).toContain("2026-06-08");
  });

  it("セクションタイトルがH2見出しになる", () => {
    const result = renderMarkdown(makeDoc());
    expect(result).toContain("## ご提案の概要");
  });

  it("callouts がブロック引用になる", () => {
    const result = renderMarkdown(makeDoc());
    expect(result).toContain("> -");
  });
});

describe("renderHtml", () => {
  it("HTML 文字列を返す", () => {
    const result = renderHtml(makeDoc());
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("顧客名が含まれる", () => {
    const result = renderHtml(makeDoc());
    expect(result).toContain("田中花子");
  });

  it("セージグリーンカラーが含まれる", () => {
    const result = renderHtml(makeDoc());
    expect(result).toContain("#6B8E5A");
  });

  it("lang=ja が設定されている", () => {
    const result = renderHtml(makeDoc());
    expect(result).toContain('lang="ja"');
  });

  it("印刷用メディアクエリが含まれる", () => {
    const result = renderHtml(makeDoc());
    expect(result).toContain("@media print");
  });
});

describe("renderPdfData", () => {
  it("html と cssA4 を返す", () => {
    const result = renderPdfData(makeDoc());
    expect(result.html).toBeDefined();
    expect(result.cssA4).toBeDefined();
  });

  it("html は有効な HTML", () => {
    const result = renderPdfData(makeDoc());
    expect(result.html).toContain("<!DOCTYPE html>");
  });

  it("cssA4 に A4 レイアウト指定が含まれる", () => {
    const result = renderPdfData(makeDoc());
    expect(result.cssA4).toContain("210mm");
  });
});
