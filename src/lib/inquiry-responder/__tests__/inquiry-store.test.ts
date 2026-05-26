/**
 * Tests for inquiry-store.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { InquiryStore, _resetInquiryStore } from "../inquiry-store.js";
import type { InquiryRecord } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeRecord(id: string): InquiryRecord {
  const now = "2026-05-09T09:00:00.000Z";
  return {
    id,
    channel: "hp_form",
    receivedAt: now,
    rawText: "キッチンのリフォームをお願いしたいです。",
    customerName: "テスト顧客",
    customerContact: null,
    extractedRequirements: {
      workCategory: "kitchen",
      workScale: "medium",
      locationCity: "世田谷区",
      budgetHintJpy: null,
      desiredStartMonth: null,
      contactPreference: null,
    },
    estimatedRangeJpy: {
      lowerJpy: 1_500_000,
      upperJpy: 3_000_000,
      confidence: "medium",
      basisNotes_ja: "テスト",
    },
    proposedSlots: [],
    draftReplyJa: "テスト返信",
    status: "new",
    priority: "normal",
    createdAt: now,
    updatedAt: now,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("InquiryStore — 基本 CRUD", () => {
  let s: InquiryStore;

  beforeEach(() => {
    localStorage.clear();
    _resetInquiryStore();
    s = new InquiryStore();
  });

  it("初期状態は空", () => {
    expect(s.all()).toHaveLength(0);
  });

  it("add で追加される", () => {
    s.add(makeRecord("r001"));
    expect(s.all()).toHaveLength(1);
  });

  it("byId で特定レコードを取得できる", () => {
    s.add(makeRecord("r001"));
    s.add(makeRecord("r002"));
    expect(s.byId("r001")).not.toBeNull();
    expect(s.byId("r999")).toBeNull();
  });

  it("byStatus でステータス絞り込みできる", () => {
    const r1 = { ...makeRecord("r001"), status: "new" as const };
    const r2 = { ...makeRecord("r002"), status: "replied" as const };
    s.add(r1);
    s.add(r2);
    expect(s.byStatus("new")).toHaveLength(1);
    expect(s.byStatus("replied")).toHaveLength(1);
    expect(s.byStatus("scheduled")).toHaveLength(0);
  });

  it("update で既存レコードを更新する", () => {
    s.add(makeRecord("r001"));
    const updated = { ...makeRecord("r001"), status: "replied" as const };
    s.update(updated);
    expect(s.all()).toHaveLength(1);
    expect(s.byId("r001")?.status).toBe("replied");
  });

  it("clear で全件削除", () => {
    s.add(makeRecord("r001"));
    s.add(makeRecord("r002"));
    s.clear();
    expect(s.all()).toHaveLength(0);
  });
});

describe("InquiryStore — FIFO 1000件", () => {
  it("1001件追加したとき最初の1件が削除される", () => {
    localStorage.clear();
    _resetInquiryStore();
    const s = new InquiryStore();
    for (let i = 0; i < 1001; i++) {
      s.add(makeRecord(`r${String(i).padStart(4, "0")}`));
    }
    expect(s.all()).toHaveLength(1000);
    // 最初の r0000 が削除されている
    expect(s.byId("r0000")).toBeNull();
    expect(s.byId("r0001")).not.toBeNull();
  });
});

describe("InquiryStore — ensureSeed", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetInquiryStore();
  });

  it("空の場合にシードデータを投入する", () => {
    const s = new InquiryStore();
    s.ensureSeed();
    expect(s.all().length).toBeGreaterThan(0);
  });

  it("シードデータは30件", () => {
    const s = new InquiryStore();
    s.ensureSeed();
    expect(s.all()).toHaveLength(30);
  });

  it("既存データがある場合はシードを追加しない", () => {
    const s = new InquiryStore();
    s.add(makeRecord("r001"));
    const countBefore = s.all().length;
    s.ensureSeed();
    expect(s.all().length).toBe(countBefore);
  });

  it("シードには各チャンネル (hp_form / line / discord / email / phone_memo) が含まれる", () => {
    const s = new InquiryStore();
    s.ensureSeed();
    const channels = new Set(s.all().map((r) => r.channel));
    expect(channels.has("hp_form")).toBe(true);
    expect(channels.has("line")).toBe(true);
    expect(channels.has("discord")).toBe(true);
    expect(channels.has("email")).toBe(true);
    expect(channels.has("phone_memo")).toBe(true);
  });
});

describe("InquiryStore — EventTarget", () => {
  it("add 時に inquiry-added イベントが発火する", () => {
    localStorage.clear();
    const s = new InquiryStore();
    const events: InquiryRecord[] = [];
    s.addEventListener("inquiry-added", (e) => {
      events.push((e as CustomEvent<InquiryRecord>).detail);
    });
    s.add(makeRecord("r001"));
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("r001");
  });

  it("update 時に inquiry-updated イベントが発火する", () => {
    localStorage.clear();
    const s = new InquiryStore();
    const events: InquiryRecord[] = [];
    s.add(makeRecord("r001"));
    s.addEventListener("inquiry-updated", (e) => {
      events.push((e as CustomEvent<InquiryRecord>).detail);
    });
    s.update({ ...makeRecord("r001"), status: "replied" });
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("replied");
  });
});
