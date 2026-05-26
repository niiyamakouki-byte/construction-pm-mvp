/**
 * change-order-renderer unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  renderMarkdown,
  renderHtml,
  renderPdfData,
  renderChangeOrder,
} from "../change-order-renderer.js";
import type { ChangeOrder } from "../types.js";
import { makeChangeOrderId } from "../types.js";

function makeOrder(overrides: Partial<ChangeOrder> = {}): ChangeOrder {
  return {
    id: makeChangeOrderId("co-render-test"),
    projectId: "proj-001",
    kind: "modification",
    status: "ownerApproval",
    descriptionJa: "キッチン天板を御影石に変更",
    requestedBy: "田中様",
    requestedAt: "2026-05-01T09:00:00Z",
    targetWorkItem: "キッチン工事",
    approvalRecords: [],
    ...overrides,
  };
}

describe("renderMarkdown", () => {
  it("変更指示書ヘッダーを含む", () => {
    const md = renderMarkdown(makeOrder());
    expect(md).toContain("変更指示書");
    expect(md).toContain("co-render-test");
  });

  it("変更内容を含む", () => {
    const md = renderMarkdown(makeOrder());
    expect(md).toContain("キッチン天板を御影石に変更");
  });

  it("要望者名を含む", () => {
    const md = renderMarkdown(makeOrder());
    expect(md).toContain("田中様");
  });

  it("影響分析があれば金額差分を含む", () => {
    const md = renderMarkdown(makeOrder({
      impactAnalysis: {
        costDeltaJpy: 200_000,
        scheduleDeltaDays: 2,
        affectedTrades: ["大工"],
        dependencyChain: ["配管工事"],
        costIncreaseRatioPct: 5,
      },
    }));
    expect(md).toContain("200,000");
    expect(md).toContain("大工");
    expect(md).toContain("配管工事");
  });

  it("危険信号マーカーを含む (10%以上)", () => {
    const md = renderMarkdown(makeOrder({
      impactAnalysis: {
        costDeltaJpy: 500_000,
        scheduleDeltaDays: 5,
        affectedTrades: [],
        dependencyChain: [],
        costIncreaseRatioPct: 12,
      },
    }));
    expect(md).toContain("危険");
  });

  it("承認履歴を含む", () => {
    const md = renderMarkdown(makeOrder({
      approvalRecords: [
        { role: "owner", decidedBy: "田中様", decidedAt: "2026-05-02T10:00:00Z", decision: "approved" },
      ],
    }));
    expect(md).toContain("施主");
    expect(md).toContain("田中様");
    expect(md).toContain("承認");
  });

  it("承認完了日を含む", () => {
    const md = renderMarkdown(makeOrder({
      status: "approved",
      approvedAt: "2026-05-05T00:00:00Z",
    }));
    expect(md).toContain("承認完了日");
  });

  it("却下日を含む", () => {
    const md = renderMarkdown(makeOrder({
      status: "rejected",
      rejectedAt: "2026-05-03T00:00:00Z",
    }));
    expect(md).toContain("却下日");
  });
});

describe("renderHtml", () => {
  it("HTMLドキュメントとして整形される", () => {
    const html = renderHtml(makeOrder());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html lang=\"ja\">");
    expect(html).toContain("</html>");
  });

  it("セージグリーンスタイルを含む", () => {
    const html = renderHtml(makeOrder());
    expect(html).toContain("#6B8E5A");
  });

  it("変更内容を含む", () => {
    const html = renderHtml(makeOrder());
    expect(html).toContain("キッチン天板を御影石に変更");
  });
});

describe("renderPdfData", () => {
  it("マークダウンテキストを返す", () => {
    const data = renderPdfData(makeOrder());
    expect(typeof data).toBe("string");
    expect(data).toContain("変更指示書");
  });
});

describe("renderChangeOrder", () => {
  it("markdown target で markdown を返す", () => {
    const result = renderChangeOrder(makeOrder(), "markdown");
    expect(result).toContain("#");
  });

  it("html target で HTML を返す", () => {
    const result = renderChangeOrder(makeOrder(), "html");
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("pdf_data target で文字列を返す", () => {
    const result = renderChangeOrder(makeOrder(), "pdf_data");
    expect(typeof result).toBe("string");
  });
});
