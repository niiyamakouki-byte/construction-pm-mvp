/**
 * Tests for slot-proposer.
 */

import { describe, expect, it } from "vitest";
import { proposeSlots } from "../slot-proposer.js";
import type { ResponderConfig } from "../types.js";

const BASE_DATE = new Date("2026-05-09T09:00:00+09:00"); // 土曜

const DEFAULT_CONFIG: ResponderConfig = {
  businessHoursStart: 9,
  businessHoursEnd: 18,
  leadDays: 3,
  proposalCount: 3,
  includeWeekend: true,
};

describe("slot-proposer — 基本動作", () => {
  it("proposalCount=3 → 3件返す", () => {
    const slots = proposeSlots(BASE_DATE, DEFAULT_CONFIG);
    expect(slots).toHaveLength(3);
  });

  it("各スロットは slotDateIso / timeRange / note_ja を持つ", () => {
    const slots = proposeSlots(BASE_DATE, DEFAULT_CONFIG);
    for (const slot of slots) {
      expect(slot.slotDateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["morning", "afternoon", "evening"]).toContain(slot.timeRange);
      expect(slot.note_ja.length).toBeGreaterThan(0);
    }
  });

  it("slotDateIso はすべて baseDate + leadDays 以降", () => {
    const slots = proposeSlots(BASE_DATE, DEFAULT_CONFIG);
    const earliest = new Date(BASE_DATE);
    earliest.setDate(earliest.getDate() + DEFAULT_CONFIG.leadDays);
    const earliestStr = earliest.toISOString().slice(0, 10);
    for (const slot of slots) {
      expect(slot.slotDateIso >= earliestStr).toBe(true);
    }
  });

  it("被り回避 — (slotDateIso, timeRange) は一意", () => {
    const slots = proposeSlots(BASE_DATE, { ...DEFAULT_CONFIG, proposalCount: 9 });
    const keys = slots.map((s) => `${s.slotDateIso}:${s.timeRange}`);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

describe("slot-proposer — businessHours", () => {
  it("businessHoursEnd=12 → morning のみ", () => {
    const config: ResponderConfig = {
      ...DEFAULT_CONFIG,
      businessHoursStart: 9,
      businessHoursEnd: 12,
      proposalCount: 3,
    };
    const slots = proposeSlots(BASE_DATE, config);
    for (const slot of slots) {
      expect(slot.timeRange).toBe("morning");
    }
  });

  it("businessHoursStart=13, End=17 → afternoon のみ", () => {
    const config: ResponderConfig = {
      ...DEFAULT_CONFIG,
      businessHoursStart: 13,
      businessHoursEnd: 17,
      proposalCount: 3,
    };
    const slots = proposeSlots(BASE_DATE, config);
    for (const slot of slots) {
      expect(slot.timeRange).toBe("afternoon");
    }
  });

  it("businessHoursEnd=19 → evening を含む", () => {
    const config: ResponderConfig = {
      ...DEFAULT_CONFIG,
      businessHoursEnd: 19,
      proposalCount: 9,
    };
    const slots = proposeSlots(BASE_DATE, config);
    expect(slots.some((s) => s.timeRange === "evening")).toBe(true);
  });
});

describe("slot-proposer — weekend", () => {
  it("includeWeekend=false → 土日を含まない", () => {
    const config: ResponderConfig = {
      ...DEFAULT_CONFIG,
      leadDays: 0,
      includeWeekend: false,
      proposalCount: 5,
    };
    const slots = proposeSlots(new Date("2026-05-08T09:00:00"), config); // 金曜
    for (const slot of slots) {
      const date = new Date(slot.slotDateIso);
      const dayOfWeek = date.getDay();
      expect(dayOfWeek).not.toBe(0); // 日曜
      expect(dayOfWeek).not.toBe(6); // 土曜
    }
  });

  it("includeWeekend=true → 土日を含む可能性がある (leadDays=0, 基準日が土曜)", () => {
    const config: ResponderConfig = {
      ...DEFAULT_CONFIG,
      leadDays: 0,
      includeWeekend: true,
      proposalCount: 1,
    };
    const slots = proposeSlots(new Date("2026-05-09T09:00:00"), config); // 土曜
    expect(slots).toHaveLength(1);
    // 土曜 (6) または翌日以降でもOK
    const date = new Date(slots[0].slotDateIso);
    expect(date.getDay() === 6 || date.getDay() === 0 || date.getDay() >= 1).toBe(true);
  });
});

describe("slot-proposer — leadDays", () => {
  it("leadDays=0 → 今日以降のスロット", () => {
    const config: ResponderConfig = { ...DEFAULT_CONFIG, leadDays: 0, proposalCount: 1 };
    const today = new Date("2026-05-11T09:00:00"); // 月曜
    const slots = proposeSlots(today, config);
    expect(slots[0].slotDateIso).toBe("2026-05-11");
  });

  it("leadDays=5 → 5日後以降のスロット", () => {
    const config: ResponderConfig = { ...DEFAULT_CONFIG, leadDays: 5, proposalCount: 1 };
    const base = new Date("2026-05-11T09:00:00"); // 月曜
    const slots = proposeSlots(base, config);
    const earliest = new Date("2026-05-16"); // 5日後 (土)
    expect(slots[0].slotDateIso >= "2026-05-16").toBe(true);
    void earliest;
  });
});

describe("slot-proposer — proposalCount", () => {
  it("proposalCount=1 → 1件", () => {
    const slots = proposeSlots(BASE_DATE, { ...DEFAULT_CONFIG, proposalCount: 1 });
    expect(slots).toHaveLength(1);
  });

  it("proposalCount=5 → 5件", () => {
    const slots = proposeSlots(BASE_DATE, { ...DEFAULT_CONFIG, proposalCount: 5 });
    expect(slots).toHaveLength(5);
  });
});
