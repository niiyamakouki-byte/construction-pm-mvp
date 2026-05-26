/**
 * auto-estimate-pipeline テスト
 */

import { describe, it, expect } from "vitest";
import { runAutoEstimate } from "./auto-estimate-pipeline.js";
import type { ContactSubmission } from "./contact-webhook-receiver.js";

function makeSubmission(overrides: Partial<ContactSubmission> = {}): ContactSubmission {
  return {
    id: "inquiry-test-001",
    name: "テスト 太郎",
    email: "test@example.com",
    message: "LDK 20畳のフローリング張替をお願いしたいです。標準グレードで。",
    source: "laporta-hp",
    timestamp: "2026-05-09T10:00:00.000Z",
    ...overrides,
  };
}

describe("runAutoEstimate — parse", () => {
  it("部屋タイプを正しく抽出する", () => {
    const result = runAutoEstimate(makeSubmission({ message: "LDK 20畳のリフォームを検討しています" }));
    expect(result.intent.roomType).toBe("LDK");
  });

  it("面積を正しく抽出する", () => {
    const result = runAutoEstimate(makeSubmission({ message: "20㎡のクロス張替" }));
    expect(result.intent.area?.value).toBe(20);
    expect(result.intent.area?.unit).toBe("㎡");
  });

  it("畳単位を正しく抽出する", () => {
    const result = runAutoEstimate(makeSubmission({ message: "12畳の和室を改装したい" }));
    expect(result.intent.area?.value).toBe(12);
    expect(result.intent.area?.unit).toBe("畳");
  });

  it("グレードを正しく抽出する (high)", () => {
    const result = runAutoEstimate(makeSubmission({ message: "LDK ハイグレードでリノベ希望" }));
    expect(result.intent.grade).toBe("high");
  });

  it("グレードを正しく抽出する (low)", () => {
    const result = runAutoEstimate(makeSubmission({ message: "できるだけ安くリフォームしたい" }));
    expect(result.intent.grade).toBe("low");
  });

  it("工種を正しく抽出する", () => {
    const result = runAutoEstimate(makeSubmission({ message: "クロスの張替と床工事をお願いします" }));
    expect(result.intent.tasks.length).toBeGreaterThan(0);
  });
});

describe("runAutoEstimate — レンジ計算", () => {
  it("taxIncludedLow <= taxIncludedMid <= taxIncludedHigh", () => {
    const result = runAutoEstimate(makeSubmission());
    const { estimate } = result;
    expect(estimate.taxIncludedLow).toBeLessThanOrEqual(estimate.taxIncludedMid);
    expect(estimate.taxIncludedMid).toBeLessThanOrEqual(estimate.taxIncludedHigh);
  });

  it("全て正の金額", () => {
    const result = runAutoEstimate(makeSubmission());
    expect(result.estimate.taxIncludedLow).toBeGreaterThan(0);
    expect(result.estimate.taxIncludedMid).toBeGreaterThan(0);
    expect(result.estimate.taxIncludedHigh).toBeGreaterThan(0);
  });

  it("items 配列が存在する", () => {
    const result = runAutoEstimate(makeSubmission());
    expect(Array.isArray(result.estimate.items)).toBe(true);
    expect(result.estimate.items.length).toBeGreaterThan(0);
  });
});

describe("runAutoEstimate — confidence", () => {
  it("部屋 + 面積あり → high", () => {
    const result = runAutoEstimate(makeSubmission({ message: "LDK 15畳のリフォーム" }));
    expect(result.confidence).toBe("high");
  });

  it("部屋のみ → medium", () => {
    const result = runAutoEstimate(makeSubmission({ message: "リビングのクロス張替" }));
    expect(result.confidence).toBe("medium");
  });

  it("面積のみ → medium", () => {
    const result = runAutoEstimate(makeSubmission({ message: "25㎡のリフォーム" }));
    expect(result.confidence).toBe("medium");
  });

  it("工種のみ → medium", () => {
    const result = runAutoEstimate(makeSubmission({ message: "塗装をお願いしたいです" }));
    expect(result.confidence).toBe("medium");
  });

  it("情報がほぼない → low", () => {
    const result = runAutoEstimate(makeSubmission({ message: "お見積りについて教えてください" }));
    expect(result.confidence).toBe("low");
  });
});

describe("runAutoEstimate — 出力構造", () => {
  it("submission が結果に含まれる", () => {
    const submission = makeSubmission();
    const result = runAutoEstimate(submission);
    expect(result.submission).toEqual(submission);
  });

  it("intent の rawText が message と一致する", () => {
    const msg = "LDK 20畳のリノベーション";
    const result = runAutoEstimate(makeSubmission({ message: msg }));
    expect(result.intent.rawText).toBe(msg);
  });
});
