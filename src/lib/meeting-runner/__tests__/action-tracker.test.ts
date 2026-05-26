/**
 * action-tracker unit tests.
 */

import { describe, it, expect } from "vitest";
import {
  recalcStatus,
  refreshActionStatuses,
  getUpcomingDueItems,
  getOverdueItems,
  getItemsByAssignee,
  completionRateByAssignee,
} from "../action-tracker.js";
import type { ActionItem } from "../types.js";

function makeAction(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "a-1",
    description: "図面修正",
    assignee: "田中",
    dueDate: "2026-06-01",
    status: "open",
    ...overrides,
  };
}

const NOW = new Date("2026-05-09T10:00:00Z");

describe("recalcStatus", () => {
  it("done は変化しない", () => {
    const item = makeAction({ status: "done", dueDate: "2026-01-01" });
    expect(recalcStatus(item, NOW)).toBe("done");
  });

  it("期日過ぎた open → overdue", () => {
    const item = makeAction({ status: "open", dueDate: "2026-05-01" });
    expect(recalcStatus(item, NOW)).toBe("overdue");
  });

  it("今日が期日なら overdue にならない", () => {
    const item = makeAction({ status: "open", dueDate: "2026-05-09" });
    expect(recalcStatus(item, NOW)).toBe("open");
  });

  it("期日が未来なら元のステータスを保持", () => {
    const item = makeAction({ status: "in_progress", dueDate: "2026-06-01" });
    expect(recalcStatus(item, NOW)).toBe("in_progress");
  });
});

describe("refreshActionStatuses", () => {
  it("複数アイテムのステータスを一括更新する", () => {
    const items = [
      makeAction({ id: "a1", status: "open", dueDate: "2026-04-01" }),
      makeAction({ id: "a2", status: "done", dueDate: "2026-04-01" }),
      makeAction({ id: "a3", status: "open", dueDate: "2026-06-01" }),
    ];
    const result = refreshActionStatuses(items, NOW);
    expect(result.find((i) => i.id === "a1")?.status).toBe("overdue");
    expect(result.find((i) => i.id === "a2")?.status).toBe("done");
    expect(result.find((i) => i.id === "a3")?.status).toBe("open");
  });
});

describe("getUpcomingDueItems", () => {
  it("3日以内の未完了アイテムを返す", () => {
    const items = [
      makeAction({ id: "near", dueDate: "2026-05-11", status: "open" }),
      makeAction({ id: "far", dueDate: "2026-05-20", status: "open" }),
      makeAction({ id: "done", dueDate: "2026-05-10", status: "done" }),
    ];
    const result = getUpcomingDueItems(items, 3, NOW);
    expect(result.map((i) => i.id)).toContain("near");
    expect(result.map((i) => i.id)).not.toContain("far");
    expect(result.map((i) => i.id)).not.toContain("done");
  });

  it("withinDays=0 なら今日期限のみ返す", () => {
    const items = [
      makeAction({ id: "today", dueDate: "2026-05-09", status: "open" }),
      makeAction({ id: "tomorrow", dueDate: "2026-05-10", status: "open" }),
    ];
    const result = getUpcomingDueItems(items, 0, NOW);
    expect(result.map((i) => i.id)).toContain("today");
    expect(result.map((i) => i.id)).not.toContain("tomorrow");
  });
});

describe("getOverdueItems", () => {
  it("期日超過のアイテムのみ返す", () => {
    const items = [
      makeAction({ id: "overdue", dueDate: "2026-05-01", status: "open" }),
      makeAction({ id: "ok", dueDate: "2026-06-01", status: "open" }),
      makeAction({ id: "done", dueDate: "2026-04-01", status: "done" }),
    ];
    const result = getOverdueItems(items, NOW);
    expect(result.map((i) => i.id)).toEqual(["overdue"]);
  });
});

describe("getItemsByAssignee", () => {
  it("担当者でフィルタリングできる", () => {
    const items = [
      makeAction({ id: "a1", assignee: "田中" }),
      makeAction({ id: "a2", assignee: "鈴木" }),
      makeAction({ id: "a3", assignee: "田中" }),
    ];
    const result = getItemsByAssignee(items, "田中");
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.assignee === "田中")).toBe(true);
  });
});

describe("completionRateByAssignee", () => {
  it("完了率を正しく計算する", () => {
    const items = [
      makeAction({ id: "a1", assignee: "田中", status: "done" }),
      makeAction({ id: "a2", assignee: "田中", status: "open" }),
      makeAction({ id: "a3", assignee: "鈴木", status: "done" }),
    ];
    const result = completionRateByAssignee(items);
    expect(result["田中"]).toBeCloseTo(0.5);
    expect(result["鈴木"]).toBeCloseTo(1.0);
  });

  it("空配列は空オブジェクトを返す", () => {
    expect(completionRateByAssignee([])).toEqual({});
  });
});
