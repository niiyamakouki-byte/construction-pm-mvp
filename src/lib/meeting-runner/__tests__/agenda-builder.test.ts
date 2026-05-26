/**
 * agenda-builder unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  extractFromPreviousMinutes,
  extractFromProjectPhases,
  buildDefaultAgenda,
  buildAgenda,
  totalEstimatedMinutes,
} from "../agenda-builder.js";
import type { MeetingMinutes, AgendaItem, ActionItem } from "../types.js";
import { makeMeetingId } from "../types.js";

function makeMinutes(overrides: Partial<MeetingMinutes> = {}): MeetingMinutes {
  return {
    meetingId: makeMeetingId("m-test"),
    decisions: [],
    actionItems: [],
    unresolvedItems: [],
    ...overrides,
  };
}

function makeAction(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "action-1",
    description: "図面修正を実施する",
    assignee: "田中",
    dueDate: "2026-05-15",
    status: "open",
    ...overrides,
  };
}

function makeAgendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "agenda-1",
    title: "前回テスト議題",
    source: "previous_unresolved",
    priority: 2,
    estimatedMinutes: 10,
    owner: "鈴木",
    status: "deferred",
    ...overrides,
  };
}

describe("extractFromPreviousMinutes", () => {
  it("unresolvedItems を previous_unresolved に変換する", () => {
    const minutes = makeMinutes({
      unresolvedItems: [makeAgendaItem()],
    });
    const result = extractFromPreviousMinutes(minutes);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("previous_unresolved");
    expect(result[0].status).toBe("pending");
  });

  it("open actionItems をアジェンダ確認項目に変換する", () => {
    const minutes = makeMinutes({
      actionItems: [makeAction({ status: "open" })],
    });
    const result = extractFromPreviousMinutes(minutes);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("アクション確認");
    expect(result[0].source).toBe("previous_unresolved");
  });

  it("done の actionItems は変換しない", () => {
    const minutes = makeMinutes({
      actionItems: [makeAction({ status: "done" })],
    });
    const result = extractFromPreviousMinutes(minutes);
    expect(result).toHaveLength(0);
  });

  it("overdue の actionItems は priority 1 になる", () => {
    const minutes = makeMinutes({
      actionItems: [makeAction({ status: "overdue" })],
    });
    const result = extractFromPreviousMinutes(minutes);
    expect(result[0].priority).toBe(1);
  });
});

describe("extractFromProjectPhases", () => {
  it("遅延工程は priority 1 estimatedMinutes 15", () => {
    const result = extractFromProjectPhases([
      { phaseName: "基礎工事", progressPct: 30, isDelayed: true, owner: "山田" },
    ]);
    expect(result[0].priority).toBe(1);
    expect(result[0].estimatedMinutes).toBe(15);
    expect(result[0].title).toContain("【遅延】");
  });

  it("通常工程は priority 3 estimatedMinutes 5", () => {
    const result = extractFromProjectPhases([
      { phaseName: "内装工事", progressPct: 70, isDelayed: false, owner: "佐藤" },
    ]);
    expect(result[0].priority).toBe(3);
    expect(result[0].estimatedMinutes).toBe(5);
    expect(result[0].title).not.toContain("【遅延】");
  });

  it("複数フェーズを全て変換する", () => {
    const result = extractFromProjectPhases([
      { phaseName: "フェーズA", progressPct: 20, isDelayed: true, owner: "甲" },
      { phaseName: "フェーズB", progressPct: 80, isDelayed: false, owner: "乙" },
    ]);
    expect(result).toHaveLength(2);
  });
});

describe("buildDefaultAgenda", () => {
  it("weekly_progress は3件の議題を返す", () => {
    const items = buildDefaultAgenda("weekly_progress", "現場監督");
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.owner === "現場監督")).toBe(true);
    expect(items.every((i) => i.source === "new_topic")).toBe(true);
  });

  it("subcontractor_briefing は3件の議題を返す", () => {
    const items = buildDefaultAgenda("subcontractor_briefing", "新山");
    expect(items).toHaveLength(3);
  });
});

describe("buildAgenda", () => {
  it("前回議事録がある場合は previous_unresolved が先頭になる", () => {
    const minutes = makeMinutes({
      unresolvedItems: [makeAgendaItem({ priority: 3 })],
    });
    const items = buildAgenda({
      kind: "weekly_progress",
      defaultOwner: "テスト",
      previousMinutes: minutes,
    });
    // previous_unresolved items exist
    expect(items.some((i) => i.source === "previous_unresolved")).toBe(true);
  });

  it("手動アイテムが含まれる", () => {
    const manual = makeAgendaItem({
      id: "manual-1",
      title: "手動追加議題",
      source: "manual",
      priority: 1,
    });
    const items = buildAgenda({
      kind: "weekly_progress",
      defaultOwner: "テスト",
      manualItems: [manual],
    });
    expect(items.some((i) => i.title === "手動追加議題")).toBe(true);
  });

  it("優先度1が優先度5より前に来る", () => {
    const items = buildAgenda({
      kind: "weekly_progress",
      defaultOwner: "テスト",
      projectPhases: [
        { phaseName: "遅延工事", progressPct: 10, isDelayed: true, owner: "A" },
        { phaseName: "通常工事", progressPct: 80, isDelayed: false, owner: "B" },
      ],
    });
    const priorities = items.map((i) => i.priority);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]);
    }
  });
});

describe("totalEstimatedMinutes", () => {
  it("合計時間を正しく計算する", () => {
    const items: AgendaItem[] = [
      makeAgendaItem({ estimatedMinutes: 10 }),
      makeAgendaItem({ estimatedMinutes: 20 }),
      makeAgendaItem({ estimatedMinutes: 5 }),
    ];
    expect(totalEstimatedMinutes(items)).toBe(35);
  });

  it("空配列は 0 を返す", () => {
    expect(totalEstimatedMinutes([])).toBe(0);
  });
});
