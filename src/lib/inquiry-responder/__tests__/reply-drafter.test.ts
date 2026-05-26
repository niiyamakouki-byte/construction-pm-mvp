/**
 * Tests for reply-drafter.
 */

import { describe, expect, it } from "vitest";
import { draftReply, shouldRecommendSiteVisit, canHandleSameDay } from "../reply-drafter.js";
import type { ExtractedRequirements, EstimatedRange, MeetingSlotProposal, WorkCategory, WorkScale } from "../types.js";

function makeReqs(
  workCategory: WorkCategory = "kitchen",
  workScale: WorkScale = "medium",
  locationCity: string | null = null,
): ExtractedRequirements {
  return {
    workCategory,
    workScale,
    locationCity,
    budgetHintJpy: null,
    desiredStartMonth: null,
    contactPreference: null,
  };
}

function makeRange(
  lowerJpy = 1_500_000,
  upperJpy = 3_000_000,
  confidence: "low" | "medium" | "high" = "medium",
): EstimatedRange {
  return {
    lowerJpy,
    upperJpy,
    confidence,
    basisNotes_ja: "テスト用概算",
  };
}

function makeSlot(dateIso: string, timeRange: "morning" | "afternoon" | "evening"): MeetingSlotProposal {
  return { slotDateIso: dateIso, timeRange, note_ja: `${dateIso} ${timeRange}` };
}

// ── shouldRecommendSiteVisit ───────────────────────────────────────────────

describe("shouldRecommendSiteVisit", () => {
  it("large + high → true", () => {
    expect(shouldRecommendSiteVisit(makeReqs("full_renovation", "large"), makeRange(8_000_000, 20_000_000, "high"))).toBe(true);
  });

  it("extra_large + high → true", () => {
    expect(shouldRecommendSiteVisit(makeReqs("full_renovation", "extra_large"), makeRange(20_000_000, 50_000_000, "high"))).toBe(true);
  });

  it("medium + high → false", () => {
    expect(shouldRecommendSiteVisit(makeReqs("kitchen", "medium"), makeRange(1_500_000, 3_000_000, "high"))).toBe(false);
  });

  it("large + medium → false (confidence not high)", () => {
    expect(shouldRecommendSiteVisit(makeReqs("full_renovation", "large"), makeRange(8_000_000, 20_000_000, "medium"))).toBe(false);
  });
});

// ── canHandleSameDay ───────────────────────────────────────────────────────

describe("canHandleSameDay", () => {
  it("repair + small → true", () => {
    expect(canHandleSameDay(makeReqs("repair", "small"))).toBe(true);
  });

  it("repair + medium → false", () => {
    expect(canHandleSameDay(makeReqs("repair", "medium"))).toBe(false);
  });

  it("kitchen + small → false", () => {
    expect(canHandleSameDay(makeReqs("kitchen", "small"))).toBe(false);
  });
});

// ── draftReply ─────────────────────────────────────────────────────────────

describe("draftReply — 本文基本構造", () => {
  const slots = [
    makeSlot("2026-05-12", "morning"),
    makeSlot("2026-05-13", "afternoon"),
    makeSlot("2026-05-14", "evening"),
  ];

  it("件名に受付番号が含まれる", () => {
    const draft = draftReply({ id: "inq-abc-0042", customerName: "田中花子", extractedRequirements: makeReqs(), estimatedRangeJpy: makeRange(), proposedSlots: slots });
    expect(draft).toContain("受付#0042");
  });

  it("顧客名がある場合「{name} 様」が含まれる", () => {
    const draft = draftReply({ id: "inq-001", customerName: "佐藤一郎", extractedRequirements: makeReqs(), estimatedRangeJpy: makeRange(), proposedSlots: slots });
    expect(draft).toContain("佐藤一郎 様");
  });

  it("顧客名なしの場合「お客様」が含まれる", () => {
    const draft = draftReply({ id: "inq-001", customerName: null, extractedRequirements: makeReqs(), estimatedRangeJpy: makeRange(), proposedSlots: slots });
    expect(draft).toContain("お客様");
  });

  it("概算レンジが含まれる", () => {
    const draft = draftReply({ id: "inq-001", customerName: "テスト", extractedRequirements: makeReqs(), estimatedRangeJpy: makeRange(1_500_000, 3_000_000), proposedSlots: slots });
    expect(draft).toContain("150万円");
    expect(draft).toContain("300万円");
  });

  it("電話番号 03-6876-7749 が含まれる", () => {
    const draft = draftReply({ id: "inq-001", customerName: null, extractedRequirements: makeReqs(), estimatedRangeJpy: makeRange(), proposedSlots: slots });
    expect(draft).toContain("03-6876-7749");
  });

  it("候補日3案が含まれる", () => {
    const draft = draftReply({ id: "inq-001", customerName: null, extractedRequirements: makeReqs(), estimatedRangeJpy: makeRange(), proposedSlots: slots });
    expect(draft).toContain("第1候補");
    expect(draft).toContain("第2候補");
    expect(draft).toContain("第3候補");
  });
});

describe("draftReply — 現地調査推奨フラグ", () => {
  it("large + confidence high → 現地調査推奨が含まれる", () => {
    const draft = draftReply({
      id: "inq-001",
      customerName: null,
      extractedRequirements: makeReqs("full_renovation", "large"),
      estimatedRangeJpy: makeRange(8_000_000, 20_000_000, "high"),
      proposedSlots: [],
    });
    expect(draft).toContain("現地調査推奨");
  });

  it("medium + high → 現地調査推奨を含まない", () => {
    const draft = draftReply({
      id: "inq-001",
      customerName: null,
      extractedRequirements: makeReqs("kitchen", "medium"),
      estimatedRangeJpy: makeRange(1_500_000, 3_000_000, "high"),
      proposedSlots: [],
    });
    expect(draft).not.toContain("現地調査推奨");
  });
});

describe("draftReply — 即日対応フラグ", () => {
  it("repair + small → 即日対応が含まれる", () => {
    const draft = draftReply({
      id: "inq-001",
      customerName: null,
      extractedRequirements: makeReqs("repair", "small"),
      estimatedRangeJpy: makeRange(100_000, 500_000),
      proposedSlots: [],
    });
    expect(draft).toContain("即日対応");
  });

  it("repair + medium → 即日対応を含まない", () => {
    const draft = draftReply({
      id: "inq-001",
      customerName: null,
      extractedRequirements: makeReqs("repair", "medium"),
      estimatedRangeJpy: makeRange(500_000, 2_000_000),
      proposedSlots: [],
    });
    expect(draft).not.toContain("即日対応");
  });
});

describe("draftReply — 全カテゴリ×規模で本文生成", () => {
  const categories: WorkCategory[] = [
    "full_renovation", "partial_renovation", "kitchen", "bath",
    "store_fit", "office_fit", "exterior", "repair", "other",
  ];
  const scales: WorkScale[] = ["small", "medium", "large", "extra_large"];

  for (const cat of categories) {
    for (const scale of scales) {
      it(`${cat} × ${scale} → 例外なく本文生成`, () => {
        const reqs = makeReqs(cat, scale);
        const range = makeRange();
        expect(() => draftReply({ id: "inq-001", customerName: "テスト", extractedRequirements: reqs, estimatedRangeJpy: range, proposedSlots: [] })).not.toThrow();
      });
    }
  }
});
