/**
 * Tests for inquiry-responder facade.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  intake,
  listByStatus,
  listUrgent,
  markReplied,
  markScheduled,
  markClosed,
  _resetIdCounter,
} from "../inquiry-responder.js";
import { _resetInquiryStore, InquiryStore } from "../inquiry-store.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const BASE_DATE = new Date("2026-05-11T09:00:00+09:00"); // 月曜

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  _resetInquiryStore();
  _resetIdCounter();
});

// ── intake ─────────────────────────────────────────────────────────────────

describe("intake", () => {
  it("InquiryRecord を返す", () => {
    const r = intake("hp_form", "キッチンのリフォームをお願いしたい", "田中花子", null, undefined, BASE_DATE);
    expect(r).toBeDefined();
    expect(r.id).toBeTruthy();
    expect(r.channel).toBe("hp_form");
    expect(r.rawText).toBe("キッチンのリフォームをお願いしたい");
    expect(r.customerName).toBe("田中花子");
  });

  it("extractedRequirements が生成されている", () => {
    const r = intake("hp_form", "キッチンのリフォームをお願いしたい", null, null, undefined, BASE_DATE);
    expect(r.extractedRequirements.workCategory).toBe("kitchen");
  });

  it("estimatedRangeJpy が生成されている", () => {
    const r = intake("hp_form", "キッチンのリフォームをお願いしたい", null, null, undefined, BASE_DATE);
    expect(r.estimatedRangeJpy.lowerJpy).toBeGreaterThan(0);
    expect(r.estimatedRangeJpy.upperJpy).toBeGreaterThan(r.estimatedRangeJpy.lowerJpy);
  });

  it("proposedSlots が3件生成されている", () => {
    const r = intake("hp_form", "キッチンのリフォームをお願いしたい", null, null, undefined, BASE_DATE);
    expect(r.proposedSlots).toHaveLength(3);
  });

  it("draftReplyJa が空でない", () => {
    const r = intake("hp_form", "キッチンのリフォームをお願いしたい", null, null, undefined, BASE_DATE);
    expect(r.draftReplyJa.length).toBeGreaterThan(0);
    expect(r.draftReplyJa).toContain("ラポルタ");
  });

  it("status は triaged", () => {
    const r = intake("hp_form", "キッチンのリフォームをお願いしたい", null, null, undefined, BASE_DATE);
    expect(r.status).toBe("triaged");
  });

  it("priority が設定されている", () => {
    const r = intake("hp_form", "至急お願いします", null, null, undefined, BASE_DATE);
    expect(r.priority).toBe("urgent");
  });

  it("phone_memo → priority=high", () => {
    const r = intake("phone_memo", "キッチンリフォーム相談", null, null, undefined, BASE_DATE);
    expect(r.priority).toBe("high");
  });

  it("保存されている (listByStatus で取得できる)", () => {
    intake("hp_form", "キッチンのリフォーム", null, null, undefined, BASE_DATE);
    const triaged = listByStatus("triaged");
    expect(triaged.length).toBeGreaterThanOrEqual(1);
  });
});

// ── listByStatus ───────────────────────────────────────────────────────────

describe("listByStatus", () => {
  it("ステータスで絞り込める", () => {
    const r1 = intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    markReplied(r1.id);
    const replied = listByStatus("replied");
    expect(replied.some((r) => r.id === r1.id)).toBe(true);
  });

  it("一致しないステータスは返さない", () => {
    intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    const scheduled = listByStatus("scheduled");
    expect(scheduled).toHaveLength(0);
  });
});

// ── listUrgent ─────────────────────────────────────────────────────────────

describe("listUrgent", () => {
  it("urgent / high のみ返す", () => {
    intake("phone_memo", "至急お願いします", null, null, undefined, BASE_DATE); // urgent
    intake("phone_memo", "相談があります", null, null, undefined, BASE_DATE); // high
    intake("email", "キッチンリフォーム", null, null, undefined, BASE_DATE); // normal
    const urgent = listUrgent();
    for (const r of urgent) {
      expect(["urgent", "high"]).toContain(r.priority);
    }
    expect(urgent.length).toBeGreaterThanOrEqual(2);
  });
});

// ── state transitions ──────────────────────────────────────────────────────

describe("markReplied", () => {
  it("status を replied に変更する", () => {
    const r = intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    const updated = markReplied(r.id);
    expect(updated?.status).toBe("replied");
  });

  it("存在しないIDは null を返す", () => {
    expect(markReplied("nonexistent-id")).toBeNull();
  });
});

describe("markScheduled", () => {
  it("status を scheduled に変更する", () => {
    const r = intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    const slot = { slotDateIso: "2026-05-14", timeRange: "morning" as const, note_ja: "5/14午前" };
    const updated = markScheduled(r.id, slot);
    expect(updated?.status).toBe("scheduled");
  });

  it("chosenSlot が proposedSlots の先頭に配置される", () => {
    const r = intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    const slot = { slotDateIso: "2026-05-20", timeRange: "afternoon" as const, note_ja: "5/20午後" };
    const updated = markScheduled(r.id, slot);
    expect(updated?.proposedSlots[0].slotDateIso).toBe("2026-05-20");
  });

  it("存在しないIDは null を返す", () => {
    const slot = { slotDateIso: "2026-05-20", timeRange: "morning" as const, note_ja: "テスト" };
    expect(markScheduled("nonexistent-id", slot)).toBeNull();
  });
});

describe("markClosed", () => {
  it("won=true → closed_won", () => {
    const r = intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    const updated = markClosed(r.id, true);
    expect(updated?.status).toBe("closed_won");
  });

  it("won=false → closed_lost", () => {
    const r = intake("hp_form", "キッチンリフォーム", null, null, undefined, BASE_DATE);
    const updated = markClosed(r.id, false);
    expect(updated?.status).toBe("closed_lost");
  });

  it("存在しないIDは null を返す", () => {
    expect(markClosed("nonexistent-id", true)).toBeNull();
  });
});

// ── Full flow ──────────────────────────────────────────────────────────────

describe("intake → state transitions フロー", () => {
  it("new → triaged (intake) → replied → scheduled → closed_won", () => {
    const r1 = intake("hp_form", "全面リノベーション 1500万円を検討中です", "山田太郎", "test@test.com", undefined, BASE_DATE);
    expect(r1.status).toBe("triaged");

    const r2 = markReplied(r1.id);
    expect(r2?.status).toBe("replied");

    const slot = r1.proposedSlots[0];
    const r3 = markScheduled(r1.id, slot);
    expect(r3?.status).toBe("scheduled");

    const r4 = markClosed(r1.id, true);
    expect(r4?.status).toBe("closed_won");
  });
});
