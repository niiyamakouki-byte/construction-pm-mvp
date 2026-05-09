/**
 * minutes-recorder unit tests.
 */

import { describe, it, expect } from "vitest";
import { recordMinutes, appendToMinutes, classifyLine } from "../minutes-recorder.js";
import { makeMeetingId } from "../types.js";

const MEETING_DATE = new Date("2026-05-09T10:00:00Z");
const MEETING_ID = makeMeetingId("m-test");

describe("classifyLine", () => {
  it("決定キーワードを含む行は decision", () => {
    expect(classifyLine("外壁仕上げをAタイプに決定")).toBe("decision");
    expect(classifyLine("変更を承認した")).toBe("decision");
    expect(classifyLine("で確定しました")).toBe("decision");
  });

  it("アクションキーワードを含む行は action", () => {
    expect(classifyLine("田中が図面修正をすること")).toBe("action");
    expect(classifyLine("5/15まで提出してください")).toBe("action");
    expect(classifyLine("山田担当で手配する")).toBe("action");
  });

  it("未解決キーワードを含む行は unresolved", () => {
    expect(classifyLine("この件は継続審議とする")).toBe("unresolved");
    expect(classifyLine("次回確認が必要な事項")).toBe("unresolved");
    expect(classifyLine("保留事項として持ち越し")).toBe("unresolved");
  });

  it("該当なしの行は other", () => {
    expect(classifyLine("今日のお天気はいいですね")).toBe("other");
    expect(classifyLine("")).toBe("other");
  });

  it("decision が unresolved より優先される", () => {
    expect(classifyLine("継続審議に決定")).toBe("decision");
  });
});

describe("recordMinutes", () => {
  it("決定事項を抽出できる", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: ["外壁材をAパネルに決定", "工期延長は承認"],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.decisions).toHaveLength(2);
    expect(minutes.decisions[0]).toBe("外壁材をAパネルに決定");
  });

  it("アクションアイテムを抽出できる", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: ["田中が図面修正をすること、5/15まで提出"],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.actionItems).toHaveLength(1);
    expect(minutes.actionItems[0].description).toContain("図面修正");
    expect(minutes.actionItems[0].assignee).toBe("田中");
  });

  it("未解決事項を抽出できる", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: ["設備仕様は次回持越しとする"],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.unresolvedItems).toHaveLength(1);
    expect(minutes.unresolvedItems[0].status).toBe("deferred");
  });

  it("空行は無視される", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: ["", "  ", ""],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.decisions).toHaveLength(0);
    expect(minutes.actionItems).toHaveLength(0);
    expect(minutes.unresolvedItems).toHaveLength(0);
  });

  it("mixedな行を正しく3分類する", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: [
        "予算を500万に確定した",
        "鈴木が材料の発注を手配する",
        "外構デザインは継続審議",
      ],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.decisions).toHaveLength(1);
    expect(minutes.actionItems).toHaveLength(1);
    expect(minutes.unresolvedItems).toHaveLength(1);
  });

  it("meetingId が正しく設定される", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: [],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.meetingId).toBe(MEETING_ID);
  });

  it("ISO日付形式の期日を正しく解析する", () => {
    const minutes = recordMinutes({
      meetingId: MEETING_ID,
      lines: ["山田が2026-06-01まで完了すること"],
      meetingDate: MEETING_DATE,
    });
    expect(minutes.actionItems[0].dueDate).toBe("2026-06-01");
  });
});

describe("appendToMinutes", () => {
  it("既存の议事録に追記できる", () => {
    const existing = recordMinutes({
      meetingId: MEETING_ID,
      lines: ["案A採用に決定"],
      meetingDate: MEETING_DATE,
    });
    const updated = appendToMinutes(
      existing,
      ["田中が図面修正をすること"],
      MEETING_DATE,
    );
    expect(updated.decisions).toHaveLength(1);
    expect(updated.actionItems).toHaveLength(1);
    expect(updated.meetingId).toBe(MEETING_ID);
  });
});
