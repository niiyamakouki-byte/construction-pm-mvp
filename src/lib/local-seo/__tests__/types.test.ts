/**
 * types.test.ts — Sprint 19-B
 */

import { describe, it, expect } from "vitest";
import {
  makeSeoArticleId,
  makeKeywordTargetId,
  makeBackLinkId,
  makeSeoMetricsId,
  regionScopeLabelJa,
  articleStatusLabelJa,
  keywordIntentLabelJa,
  serpRankBucketLabelJa,
} from "../types.js";

describe("branded IDs", () => {
  it("makeSeoArticleId が文字列を返す", () => {
    expect(makeSeoArticleId("art-001")).toBe("art-001");
  });

  it("makeKeywordTargetId が文字列を返す", () => {
    expect(makeKeywordTargetId("kw-001")).toBe("kw-001");
  });

  it("makeBackLinkId が文字列を返す", () => {
    expect(makeBackLinkId("bl-001")).toBe("bl-001");
  });

  it("makeSeoMetricsId が文字列を返す", () => {
    expect(makeSeoMetricsId("snap-001")).toBe("snap-001");
  });
});

describe("regionScopeLabelJa", () => {
  it("全5地域にラベルがある", () => {
    expect(regionScopeLabelJa.city_setagaya).toBe("世田谷区");
    expect(regionScopeLabelJa.city_shibuya).toBe("渋谷区");
    expect(regionScopeLabelJa.city_minato).toBe("港区");
    expect(regionScopeLabelJa.city_yokohama).toBe("横浜市");
    expect(regionScopeLabelJa.city_kawasaki).toBe("川崎市");
  });
});

describe("articleStatusLabelJa", () => {
  it("全4ステータスにラベルがある", () => {
    const statuses = ["draft", "scheduled", "published", "archived"] as const;
    for (const s of statuses) {
      expect(articleStatusLabelJa[s]).toBeTruthy();
    }
  });
});

describe("keywordIntentLabelJa", () => {
  it("全3インテントにラベルがある", () => {
    expect(keywordIntentLabelJa.research).toBeTruthy();
    expect(keywordIntentLabelJa.local_purchase).toBeTruthy();
    expect(keywordIntentLabelJa.service).toBeTruthy();
  });
});

describe("serpRankBucketLabelJa", () => {
  it("全4バケットにラベルがある", () => {
    expect(serpRankBucketLabelJa.top3).toBe("TOP3");
    expect(serpRankBucketLabelJa.top10).toBe("TOP10");
    expect(serpRankBucketLabelJa.top30).toBe("TOP30");
    expect(serpRankBucketLabelJa.beyond).toBe("30位以下");
  });
});
