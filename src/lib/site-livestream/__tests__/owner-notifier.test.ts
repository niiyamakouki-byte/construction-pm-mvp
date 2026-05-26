/**
 * owner-notifier.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  dispatchNotifications,
  _getNotificationQueue,
  _clearNotificationQueue,
} from "../owner-notifier.js";
import type { LivestreamSession, LivestreamPost, OwnerNotificationPreference } from "../types.js";
import { makeLivestreamSessionId } from "../types.js";

const defaultPrefs: OwnerNotificationPreference = {
  ownerName: "田中施主",
  projectId: "proj-001",
  channels: ["email", "discord"],
  digestFrequency: "immediate",
  quietHours: { start: "22:00", end: "07:00" },
};

function makeSession(prefsOverrides: Partial<OwnerNotificationPreference> = {}): LivestreamSession {
  return {
    id: makeLivestreamSessionId("ls-1"),
    projectId: "proj-001",
    ownerName: "田中施主",
    posts: [],
    notificationPrefs: { ...defaultPrefs, ...prefsOverrides },
    totalDurationSec: 0,
    lastActivityAt: "2026-05-09T10:00:00.000Z",
  };
}

function makePost(): LivestreamPost {
  return {
    id: "post-1",
    projectId: "proj-001",
    channelKind: "recorded_highlight",
    postedByName: "田中",
    postedByRole: "supervisor",
    title: "解体作業",
    description: "",
    mediaKind: "video",
    durationSec: 300,
    capturedAt: "2026-05-09T10:00:00.000Z",
    status: "pending_review",
    autoCaptionsJa: "",
    ownerNotificationSent: false,
    viewCount: 0,
  };
}

beforeEach(() => {
  _clearNotificationQueue();
  vi.restoreAllMocks();
});

describe("dispatchNotifications — immediate", () => {
  it("quietHours 外の場合は全チャネルを dispatched に含む", () => {
    // 10:00 JST = quiet時間 (22:00-07:00) の外
    const now = new Date("2026-05-09T10:00:00.000Z");
    const result = dispatchNotifications(makeSession(), makePost(), now);
    expect(result.dispatched).toContain("email");
    expect(result.dispatched).toContain("discord");
    expect(result.skipped).toHaveLength(0);
  });

  it("dispatched に2チャネルが含まれる", () => {
    const now = new Date("2026-05-09T10:00:00.000Z");
    const result = dispatchNotifications(makeSession(), makePost(), now);
    expect(result.dispatched).toHaveLength(2);
  });
});

describe("dispatchNotifications — quietHours", () => {
  it("23:00 は 22:00-07:00 の範囲内なので全チャネルが skipped", () => {
    const now = new Date("2026-05-09T23:00:00+09:00");
    // Use UTC time that maps to 23:00 JST
    const nowJST = new Date("2026-05-09T14:00:00.000Z"); // 23:00 JST
    const result = dispatchNotifications(makeSession(), makePost(), nowJST);
    expect(result.dispatched).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
    void now; // suppress unused warning
  });
});

describe("dispatchNotifications — daily/weekly queue", () => {
  it("daily のとき dispatched が空で skipped にキュー済みが含まれる", () => {
    const now = new Date("2026-05-09T10:00:00.000Z");
    const result = dispatchNotifications(
      makeSession({ digestFrequency: "daily" }),
      makePost(),
      now,
    );
    expect(result.dispatched).toHaveLength(0);
    expect(result.skipped.some((s) => s.includes("queued"))).toBe(true);
  });

  it("weekly のとき通知キューにスタックされる", () => {
    const now = new Date("2026-05-09T10:00:00.000Z");
    dispatchNotifications(
      makeSession({ digestFrequency: "weekly" }),
      makePost(),
      now,
    );
    expect(_getNotificationQueue().length).toBeGreaterThan(0);
  });
});

describe("dispatchNotifications — 単一チャネル", () => {
  it("push のみのとき dispatched に push が含まれる", () => {
    const now = new Date("2026-05-09T10:00:00.000Z");
    const result = dispatchNotifications(
      makeSession({ channels: ["push"] }),
      makePost(),
      now,
    );
    expect(result.dispatched).toContain("push");
  });
});
