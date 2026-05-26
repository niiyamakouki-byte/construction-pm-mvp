/**
 * caption-generator.test.ts
 */

import { describe, it, expect } from "vitest";
import { generateCaption, enrichCaptionsForSession } from "../caption-generator.js";
import type { LivestreamPost, LivestreamSession, OwnerNotificationPreference } from "../types.js";
import { makeLivestreamSessionId } from "../types.js";

function makePost(overrides: Partial<LivestreamPost> = {}): LivestreamPost {
  return {
    id: "post-1",
    projectId: "proj-001",
    channelKind: "recorded_highlight",
    postedByName: "田中",
    postedByRole: "supervisor",
    title: "解体作業の進捗",
    description: "1Fリビングの解体が完了",
    mediaKind: "video",
    durationSec: 300,
    capturedAt: "2026-05-09T10:00:00.000Z",
    status: "pending_review",
    autoCaptionsJa: "",
    ownerNotificationSent: false,
    viewCount: 0,
    ...overrides,
  };
}

const defaultPrefs: OwnerNotificationPreference = {
  ownerName: "田中施主",
  projectId: "proj-001",
  channels: ["email"],
  digestFrequency: "immediate",
  quietHours: { start: "22:00", end: "07:00" },
};

describe("generateCaption", () => {
  it("日付が含まれる", () => {
    const caption = generateCaption(makePost());
    expect(caption).toContain("2026/05/09");
  });

  it("チャネル種別ラベルが含まれる", () => {
    const caption = generateCaption(makePost({ channelKind: "recorded_highlight" }));
    expect(caption).toContain("録画ハイライト");
  });

  it("投稿者名が含まれる", () => {
    const caption = generateCaption(makePost());
    expect(caption).toContain("田中");
  });

  it("ロールラベルが含まれる", () => {
    const caption = generateCaption(makePost({ postedByRole: "supervisor" }));
    expect(caption).toContain("監督");
  });

  it("タイトルが含まれる", () => {
    const caption = generateCaption(makePost());
    expect(caption).toContain("解体作業の進捗");
  });

  it("durationSec が 60 秒以上のとき「分」表示", () => {
    const caption = generateCaption(makePost({ durationSec: 300 }));
    expect(caption).toContain("約 5 分");
  });

  it("durationSec が 60 秒未満のとき「秒」表示", () => {
    const caption = generateCaption(makePost({ durationSec: 30 }));
    expect(caption).toContain("約 30 秒");
  });

  it("live_url の場合「ライブ配信中」を含む", () => {
    const caption = generateCaption(makePost({ mediaKind: "live_url", durationSec: undefined }));
    expect(caption).toContain("ライブ配信中");
  });

  it("craftsman ロールのラベルが正しい", () => {
    const caption = generateCaption(makePost({ postedByRole: "craftsman" }));
    expect(caption).toContain("職人");
  });
});

describe("enrichCaptionsForSession", () => {
  it("全 post の autoCaptionsJa が更新される", () => {
    const session: LivestreamSession = {
      id: makeLivestreamSessionId("ls-1"),
      projectId: "proj-001",
      ownerName: "田中施主",
      posts: [makePost({ id: "p1" }), makePost({ id: "p2", title: "配管作業" })],
      notificationPrefs: defaultPrefs,
      totalDurationSec: 600,
      lastActivityAt: "2026-05-09T10:00:00.000Z",
    };

    const enriched = enrichCaptionsForSession(session);
    expect(enriched.posts[0].autoCaptionsJa).not.toBe("");
    expect(enriched.posts[1].autoCaptionsJa).toContain("配管作業");
  });

  it("元のセッションを変更しない (イミュータブル)", () => {
    const session: LivestreamSession = {
      id: makeLivestreamSessionId("ls-1"),
      projectId: "proj-001",
      ownerName: "田中施主",
      posts: [makePost()],
      notificationPrefs: defaultPrefs,
      totalDurationSec: 300,
      lastActivityAt: "2026-05-09T10:00:00.000Z",
    };

    enrichCaptionsForSession(session);
    expect(session.posts[0].autoCaptionsJa).toBe("");
  });
});
