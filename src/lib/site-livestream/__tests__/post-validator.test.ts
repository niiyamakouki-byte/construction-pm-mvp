/**
 * post-validator.test.ts
 */

import { describe, it, expect } from "vitest";
import { validatePost } from "../post-validator.js";
import type { LivestreamPost } from "../types.js";

function makePost(overrides: Partial<LivestreamPost> = {}): LivestreamPost {
  return {
    id: "post-1",
    projectId: "proj-001",
    channelKind: "recorded_highlight",
    postedByName: "田中",
    postedByRole: "supervisor",
    title: "解体作業の進捗",
    description: "1Fリビングの解体が完了しました",
    mediaKind: "video",
    durationSec: 120,
    capturedAt: "2026-05-09T10:00:00.000Z",
    status: "pending_review",
    autoCaptionsJa: "",
    ownerNotificationSent: false,
    viewCount: 0,
    ...overrides,
  };
}

describe("validatePost — 正常系", () => {
  it("有効な投稿は valid=true を返す", () => {
    const result = validatePost(makePost());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("live_broadcast は durationSec なしでも valid", () => {
    const post = makePost({ channelKind: "live_broadcast", durationSec: undefined, mediaKind: "live_url", mediaUrl: "https://example.com/live" });
    const result = validatePost(post);
    expect(result.valid).toBe(true);
  });
});

describe("validatePost — タイトル必須", () => {
  it("タイトルが空文字の場合は invalid", () => {
    const result = validatePost(makePost({ title: "" }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("タイトル"))).toBe(true);
  });

  it("タイトルがスペースのみの場合は invalid", () => {
    const result = validatePost(makePost({ title: "   " }));
    expect(result.valid).toBe(false);
  });
});

describe("validatePost — durationSec 必須チェック", () => {
  it("fixed_camera で durationSec がない場合は invalid", () => {
    const result = validatePost(makePost({ channelKind: "fixed_camera", durationSec: undefined }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("長さ"))).toBe(true);
  });

  it("durationSec=0 は invalid", () => {
    const result = validatePost(makePost({ durationSec: 0 }));
    expect(result.valid).toBe(false);
  });
});

describe("validatePost — mediaUrl チェック", () => {
  it("live_url で https:// がない場合は invalid", () => {
    const result = validatePost(makePost({ mediaKind: "live_url", mediaUrl: "http://example.com/live" }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("https://"))).toBe(true);
  });

  it("live_url で mediaUrl が undefined の場合は invalid", () => {
    const result = validatePost(makePost({ mediaKind: "live_url", mediaUrl: undefined }));
    expect(result.valid).toBe(false);
  });

  it("live_url で https:// から始まれば valid", () => {
    const result = validatePost(makePost({
      channelKind: "live_broadcast",
      mediaKind: "live_url",
      mediaUrl: "https://example.com/live",
      durationSec: undefined,
    }));
    expect(result.valid).toBe(true);
  });
});

describe("validatePost — NGワード検出", () => {
  it("NGワードを含む場合は invalid", () => {
    const result = validatePost(makePost({ title: "バカな施工", description: "" }));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes("不適切"))).toBe(true);
  });

  it("複数のエラーをまとめて報告する", () => {
    const result = validatePost(makePost({ title: "", durationSec: undefined }));
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });
});
