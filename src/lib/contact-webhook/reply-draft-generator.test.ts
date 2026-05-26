/**
 * reply-draft-generator テスト
 * スナップショットテスト + 日本語フォーマット安定確認
 */

import { describe, it, expect } from "vitest";
import { generateReplyDraft } from "./reply-draft-generator.js";
import type { ContactSubmission } from "./contact-webhook-receiver.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";

function makeSubmission(overrides: Partial<ContactSubmission> = {}): ContactSubmission {
  return {
    id: "inquiry-snap-001",
    name: "田中 花子",
    email: "tanaka@example.com",
    message: "LDK 20畳のリフォームを検討しています。標準グレードでお願いします。",
    source: "laporta-hp",
    timestamp: "2026-05-09T10:00:00.000Z",
    ...overrides,
  };
}

function makeEstimate(overrides: Partial<EstimateRange> = {}): EstimateRange {
  return {
    items: [
      {
        name: "内装工事一式（概算）",
        unit: "㎡",
        qty: 20,
        unitPriceLow: 6800,
        unitPriceMid: 8000,
        unitPriceHigh: 9600,
        subtotalLow: 136000,
        subtotalMid: 160000,
        subtotalHigh: 192000,
      },
    ],
    totalLow: 136000,
    totalMid: 160000,
    totalHigh: 192000,
    taxIncludedLow: 149600,
    taxIncludedMid: 176000,
    taxIncludedHigh: 211200,
    ...overrides,
  };
}

describe("generateReplyDraft — 構造", () => {
  it("subject と body を含む ReplyDraft を返す", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(typeof draft.subject).toBe("string");
    expect(typeof draft.body).toBe("string");
  });

  it("件名に「ラポルタ」が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.subject).toContain("ラポルタ");
  });

  it("件名に「お問い合わせ」が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.subject).toContain("お問い合わせ");
  });
});

describe("generateReplyDraft — 本文コンテンツ", () => {
  it("本文に顧客名 + 様 が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission({ name: "佐藤 一郎" }), estimate: makeEstimate() });
    expect(draft.body).toContain("佐藤 一郎 様");
  });

  it("本文に「いつもお世話になっております」が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("いつもお世話になっております");
  });

  it("本文に「株式会社ラポルタ」が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("株式会社ラポルタ");
  });

  it("本文に問い合わせ内容(message)が引用されている", () => {
    const msg = "LDK 20畳のリフォームを検討しています";
    const draft = generateReplyDraft({ submission: makeSubmission({ message: msg }), estimate: makeEstimate() });
    expect(draft.body).toContain(msg);
  });

  it("本文に 3 グレード (エコノミー/標準/ハイグレード) が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("エコノミー");
    expect(draft.body).toContain("標準");
    expect(draft.body).toContain("ハイグレード");
  });

  it("本文に松竹梅ラベルが含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("梅");
    expect(draft.body).toContain("竹");
    expect(draft.body).toContain("松");
  });

  it("本文にラポルタ住所が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("世田谷区給田5-12-12");
  });

  it("本文に電話番号が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("03-6876-7749");
  });

  it("本文に「現地調査」CTA が含まれる", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    expect(draft.body).toContain("現地調査");
  });
});

describe("generateReplyDraft — confidence 別文言", () => {
  it("confidence=high で高精度向け文言が入る", () => {
    const draft = generateReplyDraft({
      submission: makeSubmission(),
      estimate: makeEstimate(),
      confidence: "high",
    });
    expect(draft.body).toContain("概算金額をご案内申し上げます");
  });

  it("confidence=low で詳細情報収集の文言が入る", () => {
    const draft = generateReplyDraft({
      submission: makeSubmission(),
      estimate: makeEstimate(),
      confidence: "low",
    });
    expect(draft.body).toContain("詳細な情報");
  });

  it("confidence=medium でデフォルト文言が入る", () => {
    const draft = generateReplyDraft({
      submission: makeSubmission(),
      estimate: makeEstimate(),
      confidence: "medium",
    });
    expect(draft.body).toContain("参考となる概算金額");
  });
});

describe("generateReplyDraft — 金額フォーマット", () => {
  it("税込金額が数値フォーマットされている", () => {
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate: makeEstimate() });
    // ¥ または ￥ + 数字 の形式 (環境によって異なる)
    expect(draft.body).toMatch(/[¥￥][\d,]+/);
  });

  it("low <= mid <= high の順で金額が並ぶ", () => {
    const estimate = makeEstimate({
      taxIncludedLow: 100000,
      taxIncludedMid: 150000,
      taxIncludedHigh: 200000,
    });
    const draft = generateReplyDraft({ submission: makeSubmission(), estimate });
    // 100,000 / 150,000 / 200,000 の位置順を確認
    const lowIdx = draft.body.indexOf("100,000");
    const midIdx = draft.body.indexOf("150,000");
    const highIdx = draft.body.indexOf("200,000");
    expect(lowIdx).toBeGreaterThan(-1);
    expect(midIdx).toBeGreaterThan(-1);
    expect(highIdx).toBeGreaterThan(-1);
    // low → mid → high の順
    expect(lowIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(highIdx);
  });
});
