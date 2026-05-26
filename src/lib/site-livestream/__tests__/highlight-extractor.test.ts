/**
 * highlight-extractor.test.ts
 */

import { describe, it, expect } from "vitest";
import { extractHighlights } from "../highlight-extractor.js";
import type { LivestreamPost } from "../types.js";

function makePost(overrides: Partial<LivestreamPost> = {}): LivestreamPost {
  return {
    id: "post-1",
    projectId: "proj-001",
    channelKind: "recorded_highlight",
    postedByName: "田中",
    postedByRole: "supervisor",
    title: "解体作業の進捗",
    description: "",
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

describe("extractHighlights — 短い動画 (< 60秒)", () => {
  it("durationSec=30 のとき単一クリップを返す", () => {
    const clips = extractHighlights(makePost({ durationSec: 30 }));
    expect(clips).toHaveLength(1);
  });

  it("durationSec 未設定のとき単一クリップを返す", () => {
    const clips = extractHighlights(makePost({ durationSec: undefined }));
    expect(clips).toHaveLength(1);
  });

  it("単一クリップの parentPostId が正しい", () => {
    const clips = extractHighlights(makePost({ durationSec: 30 }));
    expect(clips[0].parentPostId).toBe("post-1");
  });
});

describe("extractHighlights — 長い動画 (>= 60秒)", () => {
  it("durationSec=300 のとき3クリップを返す", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    expect(clips).toHaveLength(3);
  });

  it("全クリップの parentPostId が正しい", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    for (const clip of clips) {
      expect(clip.parentPostId).toBe("post-1");
    }
  });

  it("全クリップに [ハイライト] プレフィックスが含まれる", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    for (const clip of clips) {
      expect(clip.captionJa).toContain("[ハイライト]");
    }
  });

  it("startSec < endSec が成立する", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    for (const clip of clips) {
      expect(clip.startSec).toBeLessThan(clip.endSec);
    }
  });

  it("endSec が durationSec を超えない", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    for (const clip of clips) {
      expect(clip.endSec).toBeLessThanOrEqual(300);
    }
  });

  it("冒頭/中盤/終盤のラベルが含まれる", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    expect(clips[0].captionJa).toContain("冒頭");
    expect(clips[1].captionJa).toContain("中盤");
    expect(clips[2].captionJa).toContain("終盤");
  });

  it("generatedAt が ISO 形式", () => {
    const clips = extractHighlights(makePost({ durationSec: 300 }));
    for (const clip of clips) {
      expect(() => new Date(clip.generatedAt)).not.toThrow();
    }
  });
});
