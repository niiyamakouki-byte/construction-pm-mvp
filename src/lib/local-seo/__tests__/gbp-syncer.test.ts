/**
 * gbp-syncer.test.ts — Sprint 19-B
 */

import { describe, it, expect, beforeEach } from "vitest";
import { syncToGbp, getGbpActionCount, _resetGbpActionCount } from "../gbp-syncer.js";
import type { CompletionProjectMeta } from "../types.js";

const SAMPLE_META: CompletionProjectMeta = {
  siteName: "世田谷区松原3丁目マンション",
  workPart: "内装リノベーション",
  areaSqm: 75,
  durationDays: 45,
  beforePhotoCount: 8,
  afterPhotoCount: 7,
  completedAt: "2026-04-01T00:00:00.000Z",
};

beforeEach(() => {
  _resetGbpActionCount();
});

describe("syncToGbp", () => {
  it("4本の週次投稿を生成する", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    expect(result.postsGenerated).toHaveLength(4);
  });

  it("投稿に地域名が含まれる", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    for (const post of result.postsGenerated) {
      expect(post.title + post.body).toContain("世田谷区");
    }
  });

  it("4本の Q&A を生成する", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    expect(result.qaGenerated).toHaveLength(4);
  });

  it("Q&A に地域固有の費用情報が含まれる", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    const faqQ1 = result.qaGenerated[0];
    expect(faqQ1.question).toContain("世田谷区");
    expect(faqQ1.answer).toContain("㎡");
  });

  it("after 写真件数に基づいて photosScheduled が設定される (上限 10)", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    expect(result.photosScheduled).toBe(7); // afterPhotoCount=7 ≤ 10
  });

  it("afterPhotoCount > 10 の場合は 10 に制限される", () => {
    const metaLarge = { ...SAMPLE_META, afterPhotoCount: 20 };
    const result = syncToGbp("proj-001", metaLarge, "city_setagaya");
    expect(result.photosScheduled).toBe(10);
  });

  it("全投稿が posted: false (mock)", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    for (const post of result.postsGenerated) {
      expect(post.posted).toBe(false);
    }
  });

  it("投稿の scheduledAt が未来日付", () => {
    const now = new Date("2026-05-09T00:00:00.000Z");
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya", undefined, now);
    for (const post of result.postsGenerated) {
      expect(new Date(post.scheduledAt) > now).toBe(true);
    }
  });

  it("GBP アクション数が増加する", () => {
    const before = getGbpActionCount();
    syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    expect(getGbpActionCount()).toBeGreaterThan(before);
  });

  it("syncedAt が ISO 文字列", () => {
    const result = syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    expect(() => new Date(result.syncedAt)).not.toThrow();
  });
});

describe("getGbpActionCount", () => {
  it("初期値は 0", () => {
    expect(getGbpActionCount()).toBe(0);
  });

  it("syncToGbp を複数回呼ぶと累積される", () => {
    syncToGbp("proj-001", SAMPLE_META, "city_setagaya");
    const first = getGbpActionCount();
    syncToGbp("proj-002", SAMPLE_META, "city_shibuya");
    expect(getGbpActionCount()).toBeGreaterThan(first);
  });
});
