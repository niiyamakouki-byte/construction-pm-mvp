/**
 * portfolio-aggregator — inquiry-responder 連携の3指標テスト.
 *
 * newInquiryCount24h / urgentInquiryCount / pendingReplyCount
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  newInquiryCount24h,
  urgentInquiryCount,
  pendingReplyCount,
} from "../portfolio-inquiry-metrics.js";
import { _resetInquiryStore, InquiryStore } from "../inquiry-store.js";
import type { InquiryRecord } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

// ── Fixture ────────────────────────────────────────────────────────────────

function makeRecord(
  id: string,
  status: InquiryRecord["status"],
  priority: InquiryRecord["priority"],
  receivedAt: string,
): InquiryRecord {
  return {
    id,
    channel: "hp_form",
    receivedAt,
    rawText: "テスト問合せ",
    customerName: null,
    customerContact: null,
    extractedRequirements: {
      workCategory: "kitchen",
      workScale: "medium",
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
    draftReplyJa: "テスト返信",
    status,
    priority,
    createdAt: receivedAt,
    updatedAt: receivedAt,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("newInquiryCount24h", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInquiryStore();
  });

  it("過去24時間以内の new/triaged を数える", () => {
    const now = new Date();
    const within24h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2時間前
    const before24h = new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(); // 25時間前

    const s = new InquiryStore();
    s.add(makeRecord("r1", "new", "normal", within24h));
    s.add(makeRecord("r2", "triaged", "normal", within24h));
    s.add(makeRecord("r3", "new", "normal", before24h)); // 24h外
    s.add(makeRecord("r4", "replied", "normal", within24h)); // replied は除外

    const count = newInquiryCount24h();
    expect(count).toBe(2);
  });

  it("データなし → 0", () => {
    expect(newInquiryCount24h()).toBe(0);
  });
});

describe("urgentInquiryCount", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInquiryStore();
  });

  it("urgent / high の未完了問合せを数える", () => {
    const now = new Date().toISOString();
    const s = new InquiryStore();
    s.add(makeRecord("r1", "triaged", "urgent", now));
    s.add(makeRecord("r2", "new", "high", now));
    s.add(makeRecord("r3", "triaged", "medium", now));
    s.add(makeRecord("r4", "closed_won", "urgent", now)); // closed は除外

    const count = urgentInquiryCount();
    expect(count).toBe(2);
  });

  it("データなし → 0", () => {
    expect(urgentInquiryCount()).toBe(0);
  });
});

describe("pendingReplyCount", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInquiryStore();
  });

  it("new / triaged ステータスの問合せを数える", () => {
    const now = new Date().toISOString();
    const s = new InquiryStore();
    s.add(makeRecord("r1", "new", "normal", now));
    s.add(makeRecord("r2", "triaged", "normal", now));
    s.add(makeRecord("r3", "replied", "normal", now));
    s.add(makeRecord("r4", "scheduled", "normal", now));
    s.add(makeRecord("r5", "closed_won", "normal", now));

    const count = pendingReplyCount();
    expect(count).toBe(2);
  });

  it("データなし → 0", () => {
    expect(pendingReplyCount()).toBe(0);
  });
});
