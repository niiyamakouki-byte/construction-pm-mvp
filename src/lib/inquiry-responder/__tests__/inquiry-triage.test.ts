/**
 * Tests for inquiry-triage.
 */

import { describe, expect, it } from "vitest";
import { triageInquiry, priorityLabel } from "../inquiry-triage.js";
import type { InquiryRecord, InquiryChannel, WorkScale } from "../types.js";

function makeRecord(
  channel: InquiryChannel,
  workScale: WorkScale,
  rawText: string = "キッチンのリフォームをお願いしたい",
): InquiryRecord {
  const now = "2026-05-09T09:00:00.000Z";
  return {
    id: "inq-test",
    channel,
    receivedAt: now,
    rawText,
    customerName: null,
    customerContact: null,
    extractedRequirements: {
      workCategory: "kitchen",
      workScale,
      locationCity: null,
      budgetHintJpy: null,
      desiredStartMonth: null,
      contactPreference: null,
    },
    estimatedRangeJpy: {
      lowerJpy: 1_000_000,
      upperJpy: 3_000_000,
      confidence: "medium",
      basisNotes_ja: "テスト",
    },
    proposedSlots: [],
    draftReplyJa: "",
    status: "new",
    priority: "normal",
    createdAt: now,
    updatedAt: now,
  };
}

describe("inquiry-triage — urgent キーワード", () => {
  it("「至急」 → urgent", () => {
    const r = makeRecord("email", "medium", "至急ご連絡ください");
    expect(triageInquiry(r)).toBe("urgent");
  });

  it("「急ぎ」 → urgent", () => {
    const r = makeRecord("hp_form", "small", "急ぎでお願いしたい");
    expect(triageInquiry(r)).toBe("urgent");
  });

  it("「緊急」 → urgent", () => {
    const r = makeRecord("line", "medium", "緊急の修繕をお願いします");
    expect(triageInquiry(r)).toBe("urgent");
  });

  it("「早急」 → urgent", () => {
    const r = makeRecord("discord", "medium", "早急に対応をお願いします");
    expect(triageInquiry(r)).toBe("urgent");
  });
});

describe("inquiry-triage — channel-based priority", () => {
  it("phone_memo → high (urgentキーワードなし)", () => {
    const r = makeRecord("phone_memo", "medium");
    expect(triageInquiry(r)).toBe("high");
  });

  it("hp_form → medium (urgentキーワードなし, workScale=medium)", () => {
    const r = makeRecord("hp_form", "medium");
    expect(triageInquiry(r)).toBe("medium");
  });

  it("line → medium (urgentキーワードなし, workScale=medium)", () => {
    const r = makeRecord("line", "medium");
    expect(triageInquiry(r)).toBe("medium");
  });

  it("discord → medium (urgentキーワードなし, workScale=medium)", () => {
    const r = makeRecord("discord", "medium");
    expect(triageInquiry(r)).toBe("medium");
  });

  it("email → normal (urgentキーワードなし, workScale=small)", () => {
    const r = makeRecord("email", "small");
    expect(triageInquiry(r)).toBe("normal");
  });
});

describe("inquiry-triage — workScale-based priority", () => {
  it("extra_large → high (emailチャンネル)", () => {
    const r = makeRecord("email", "extra_large");
    expect(triageInquiry(r)).toBe("high");
  });

  it("large → medium (emailチャンネル)", () => {
    const r = makeRecord("email", "large");
    expect(triageInquiry(r)).toBe("medium");
  });

  it("extra_large + phone_memo → high (最高値を採用)", () => {
    const r = makeRecord("phone_memo", "extra_large");
    expect(triageInquiry(r)).toBe("high");
  });
});

describe("inquiry-triage — normal", () => {
  it("email + small + urgentなし → normal", () => {
    const r = makeRecord("email", "small", "キッチンリフォームについて");
    expect(triageInquiry(r)).toBe("normal");
  });
});

describe("priorityLabel", () => {
  it("urgent → 至急", () => {
    expect(priorityLabel("urgent")).toBe("至急");
  });

  it("high → 高", () => {
    expect(priorityLabel("high")).toBe("高");
  });

  it("medium → 中", () => {
    expect(priorityLabel("medium")).toBe("中");
  });

  it("normal → 通常", () => {
    expect(priorityLabel("normal")).toBe("通常");
  });
});
