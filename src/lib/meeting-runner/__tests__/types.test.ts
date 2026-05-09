/**
 * types unit tests — makeMeetingId, label constants.
 */

import { describe, it, expect } from "vitest";
import {
  makeMeetingId,
  MEETING_KIND_LABELS,
  AGENDA_STATUS_LABELS,
  ACTION_STATUS_LABELS,
} from "../types.js";

describe("makeMeetingId", () => {
  it("文字列をMeetingId型に変換する", () => {
    const id = makeMeetingId("meeting-123");
    expect(id).toBe("meeting-123");
  });

  it("空文字でも変換できる", () => {
    const id = makeMeetingId("");
    expect(id).toBe("");
  });
});

describe("MEETING_KIND_LABELS", () => {
  it("全てのMeetingKindにラベルが定義されている", () => {
    expect(MEETING_KIND_LABELS.weekly_progress).toBe("週次工程会議");
    expect(MEETING_KIND_LABELS.design_review).toBe("設計レビュー");
    expect(MEETING_KIND_LABELS.subcontractor_briefing).toBe("協力業者説明会");
    expect(MEETING_KIND_LABELS.site_walkthrough).toBe("現場巡視");
  });
});

describe("AGENDA_STATUS_LABELS", () => {
  it("全てのAgendaItemStatusにラベルが定義されている", () => {
    expect(AGENDA_STATUS_LABELS.pending).toBe("未着手");
    expect(AGENDA_STATUS_LABELS.discussing).toBe("審議中");
    expect(AGENDA_STATUS_LABELS.resolved).toBe("解決");
    expect(AGENDA_STATUS_LABELS.deferred).toBe("持越し");
  });
});

describe("ACTION_STATUS_LABELS", () => {
  it("全てのActionItemStatusにラベルが定義されている", () => {
    expect(ACTION_STATUS_LABELS.open).toBe("未着手");
    expect(ACTION_STATUS_LABELS.in_progress).toBe("進行中");
    expect(ACTION_STATUS_LABELS.done).toBe("完了");
    expect(ACTION_STATUS_LABELS.overdue).toBe("期限超過");
  });
});
