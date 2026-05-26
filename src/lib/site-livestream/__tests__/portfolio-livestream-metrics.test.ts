/**
 * portfolio-livestream-metrics.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pendingLivestreamReviews,
  livestreamPostsThisWeek,
  avgDailyEngagement,
  mostActiveChannelKind,
} from "../portfolio-livestream-metrics.js";
import { livestreamStore, _resetLivestreamStore } from "../livestream-store.js";
import type { LivestreamSession, LivestreamPost, OwnerNotificationPreference } from "../types.js";
import { makeLivestreamSessionId } from "../types.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});

const defaultPrefs: OwnerNotificationPreference = {
  ownerName: "田中施主",
  projectId: "proj-001",
  channels: ["email"],
  digestFrequency: "immediate",
  quietHours: { start: "22:00", end: "07:00" },
};

function makePost(overrides: Partial<LivestreamPost> = {}): LivestreamPost {
  return {
    id: `post-${Math.random()}`,
    projectId: "proj-001",
    channelKind: "recorded_highlight",
    postedByName: "田中",
    postedByRole: "supervisor",
    title: "作業進捗",
    description: "",
    mediaKind: "video",
    durationSec: 120,
    capturedAt: new Date().toISOString(), // today
    status: "pending_review",
    autoCaptionsJa: "",
    ownerNotificationSent: false,
    viewCount: 10,
    ...overrides,
  };
}

function makeSession(id: string, posts: LivestreamPost[]): LivestreamSession {
  return {
    id: makeLivestreamSessionId(id),
    projectId: "proj-001",
    ownerName: "田中施主",
    posts,
    notificationPrefs: defaultPrefs,
    totalDurationSec: posts.reduce((s, p) => s + (p.durationSec ?? 0), 0),
    lastActivityAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetLivestreamStore();
});

describe("pendingLivestreamReviews", () => {
  it("セッションがない場合は 0", () => {
    expect(pendingLivestreamReviews()).toBe(0);
  });

  it("pending_review の post 数を返す", () => {
    const s = makeSession("ls-1", [
      makePost({ status: "pending_review" }),
      makePost({ status: "published" }),
      makePost({ status: "pending_review" }),
    ]);
    livestreamStore.add(s);
    expect(pendingLivestreamReviews()).toBe(2);
  });

  it("複数セッションをまたいで集計する", () => {
    livestreamStore.add(makeSession("ls-1", [makePost({ status: "pending_review" })]));
    livestreamStore.add(makeSession("ls-2", [makePost({ status: "pending_review" })]));
    expect(pendingLivestreamReviews()).toBe(2);
  });
});

describe("livestreamPostsThisWeek", () => {
  it("セッションがない場合は 0", () => {
    expect(livestreamPostsThisWeek()).toBe(0);
  });

  it("過去7日以内の投稿を集計する", () => {
    const s = makeSession("ls-1", [
      makePost({ capturedAt: new Date().toISOString() }), // today
      makePost({ capturedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() }), // 6 days ago
    ]);
    livestreamStore.add(s);
    expect(livestreamPostsThisWeek()).toBe(2);
  });

  it("8日前の投稿は含まない", () => {
    const s = makeSession("ls-1", [
      makePost({ capturedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }),
    ]);
    livestreamStore.add(s);
    expect(livestreamPostsThisWeek()).toBe(0);
  });
});

describe("avgDailyEngagement", () => {
  it("セッションがない場合は 0", () => {
    expect(avgDailyEngagement()).toBe(0);
  });

  it("viewCount / 7 の平均を返す", () => {
    const s = makeSession("ls-1", [
      makePost({ viewCount: 70 }),
    ]);
    livestreamStore.add(s);
    expect(avgDailyEngagement()).toBe(10);
  });
});

describe("mostActiveChannelKind", () => {
  it("セッションがない場合は null", () => {
    expect(mostActiveChannelKind()).toBeNull();
  });

  it("最多チャネル種別を返す", () => {
    const s = makeSession("ls-1", [
      makePost({ channelKind: "live_broadcast" }),
      makePost({ channelKind: "live_broadcast" }),
      makePost({ channelKind: "fixed_camera" }),
    ]);
    livestreamStore.add(s);
    expect(mostActiveChannelKind()).toBe("live_broadcast");
  });

  it("単一チャネルのみの場合はそれを返す", () => {
    const s = makeSession("ls-1", [
      makePost({ channelKind: "milestone_summary" }),
    ]);
    livestreamStore.add(s);
    expect(mostActiveChannelKind()).toBe("milestone_summary");
  });
});
